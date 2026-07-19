import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaComments, FaTimes, FaWifi, FaPaperPlane, FaRobot, FaCopy, FaSync, FaUser, FaCheck, FaHome, FaFileAlt, FaDownload, FaUpload, FaPaperclip, FaCog, FaLightbulb, FaHistory, FaBookmark, FaShare, FaThumbsUp, FaThumbsDown, FaRegBookmark, FaBookmark as FaBookmarkSolid, FaMicrophone, FaStop, FaImage, FaMagic, FaStar, FaMoon, FaSun, FaPalette, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaSearch, FaFilter, FaSort, FaEye, FaEyeSlash, FaEdit, FaCheck as FaCheckCircle, FaTimes as FaTimesCircle, FaFlag, FaShieldAlt, FaClipboardList, FaCommentAlt, FaArrowDown, FaTrash, FaEllipsisH, FaEllipsisV, FaShareAlt, FaBan, FaChevronLeft, FaChevronRight, FaSave, FaLink, FaPlay, FaRegSmile, FaClock, FaCalendarAlt, FaGlobe, FaBrain, FaArrowUp, FaBell, FaInfoCircle, FaPlus, FaThumbtack } from 'react-icons/fa';
import EqualizerButton from './EqualizerButton';
import ShareChatModal from './ShareChatModal';
import SocialSharePanel from './SocialSharePanel';
import VideoPreview from './VideoPreview';
import ImagePreview from './ImagePreview';
import { toast } from 'react-toastify';
import { authenticatedFetch } from "../utils/auth";
import { API_BASE_URL } from '../config/api';
// import { FormattedTextWithLinks } from '../utils/linkFormatter.jsx';
import ListingItem from './ListingItem';
import BlogGuideItem from './BlogGuideItem';
import { isMobileDevice } from '../utils/mobileUtils';
import * as faceapi from '@vladmandic/face-api';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useImageAuditor } from '../hooks/useImageAuditor';
import Prism from 'prismjs';
import ConfirmationModal from './ConfirmationModal';
import SetuCoinParticles from './SetuCoins/SetuCoinParticles';
import UrbanSetuSpinner from './UrbanSetuSpinner';
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
import DOMPurify from 'dompurify';

// Dynamic Script Loader for CDN dependencies
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
    });
};

// Helper for running Tesseract on a canvas element
const runOcrOnCanvas = async (canvas, onProgress) => {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js');
    if (!window.Tesseract) throw new Error('Tesseract.js failed to load.');

    const result = await window.Tesseract.recognize(canvas, 'eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                onProgress?.(`OCR Page Progress: ${Math.round(m.progress * 100)}%`);
            }
        }
    });
    return result.data.text;
};

// Main function to extract text from a file locally
const extractTextFromFile = async (file, onProgress) => {
    const extension = file.name ? file.name.split('.').pop().toLowerCase() : '';
    const mimeType = file.type || '';

    // 1. Image Files (Direct OCR)
    if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension)) {
        onProgress?.('Loading OCR Engine...');
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js');
        if (!window.Tesseract) throw new Error('Tesseract.js failed to load.');

        onProgress?.('Performing character recognition...');
        const result = await window.Tesseract.recognize(file, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    onProgress?.(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });
        return result.data.text;
    }

    // 2. Plain Text / Code / CSV Files
    if (['txt', 'js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'md', 'xml', 'csv', 'sql'].includes(extension) || mimeType.startsWith('text/') || mimeType === 'application/json') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    }

    // 3. Microsoft Word Files (.docx)
    if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        onProgress?.('Loading Word parser...');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        if (!window.mammoth) throw new Error('Mammoth.js failed to load.');

        onProgress?.('Parsing Word document...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }

    // 4. Microsoft Excel Files (.xlsx / .xls)
    if (extension === 'xlsx' || extension === 'xls' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
        onProgress?.('Loading Excel parser...');
        await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
        if (!window.XLSX) throw new Error('SheetJS failed to load.');

        onProgress?.('Parsing Excel spreadsheet...');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
        let text = '';
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csv = window.XLSX.utils.sheet_to_csv(worksheet);
            if (csv.trim()) {
                text += `\n--- Sheet: ${sheetName} ---\n${csv}\n`;
            }
        });
        return text;
    }

    // 5. PDF Documents (Vector Text extraction + Scanned Image OCR Fallback)
    if (extension === 'pdf' || mimeType === 'application/pdf') {
        onProgress?.('Loading PDF reader...');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js');
        if (!window.pdfjsLib) throw new Error('PDF.js failed to load.');
        
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

        onProgress?.('Reading PDF pages...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            onProgress?.(`Parsing page ${pageNum}/${pdf.numPages}...`);
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            let pageText = textContent.items.map(item => item.str).join(' ');

            // If the page contains no selectable text, it's likely a scanned PDF page. Run OCR fallback.
            if (!pageText.trim()) {
                onProgress?.(`Page ${pageNum}/${pdf.numPages} is blank. Running OCR scan...`);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport }).promise;
                const ocrText = await runOcrOnCanvas(canvas, onProgress);
                pageText = ocrText;
            }

            fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
        }
        return fullText;
    }

    // 6. PowerPoint Presentations (.pptx)
    if (extension === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        onProgress?.('Loading PowerPoint parser...');
        await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
        if (!window.JSZip) throw new Error('JSZip failed to load.');

        onProgress?.('Parsing PowerPoint presentation...');
        const arrayBuffer = await file.arrayBuffer();
        const zip = await window.JSZip.loadAsync(arrayBuffer);
        
        let text = '';
        const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
        
        // Sort slides by number so they appear in order
        slideFiles.sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''));
            const numB = parseInt(b.replace(/[^0-9]/g, ''));
            return numA - numB;
        });

        for (let i = 0; i < slideFiles.length; i++) {
            const slideName = slideFiles[i];
            const slideNum = i + 1;
            onProgress?.(`Parsing slide ${slideNum}/${slideFiles.length}...`);
            
            const slideXmlText = await zip.files[slideName].async('text');
            
            // Extract text inside <a:t> XML tags (used in pptx for text runs)
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(slideXmlText, 'text/xml');
            const textNodes = xmlDoc.getElementsByTagName('a:t');
            
            let slideText = '';
            for (let j = 0; j < textNodes.length; j++) {
                slideText += textNodes[j].textContent + ' ';
            }
            
            if (slideText.trim()) {
                text += `\n--- Slide ${slideNum} ---\n${slideText.trim()}\n`;
            }
        }
        
        if (!text.trim()) {
            return "This PowerPoint file appears to contain no text.";
        }
        return text;
    }

    throw new Error(`Text extraction not supported for .${extension} files.`);
};

const SUGG_TEMPLATES = [
    // Real Estate
    { icon: "🏠", label: "Find properties", description: "under ₹75L with 3 BHK in prime areas", prompt: "Find properties under ₹75L with 3 BHK in premium areas" },
    { icon: "📊", label: "Compare options", description: "buying a flat vs an independent house", prompt: "Compare the benefits of buying a flat vs an independent house" },
    { icon: "🏗️", label: "Investment hotspots", description: "top real estate investment areas this year", prompt: "What are the top real estate investment hotspots this year?" },
    { icon: "💰", label: "Home loan help", description: "explain the loan approval process step-by-step", prompt: "Explain the home loan approval process step-by-step" },
    { icon: "📍", label: "Best localities", description: "find family-friendly neighborhoods", prompt: "What are the best family-friendly localities to live in?" },
    { icon: "🏢", label: "Commercial vs Residential", description: "which investment offers better returns?", prompt: "Should I invest in commercial or residential property for better long-term returns?" },
    { icon: "📋", label: "Registration checklist", description: "stamp duty and registration procedures", prompt: "What is the typical stamp duty, registration fee, and document checklist for buying a property?" },
    { icon: "🔑", label: "First-time buyer guide", description: "crucial tips before signing the contract", prompt: "Give me some crucial tips for a first-time home buyer before signing any contract" },

    // General / Productivity
    { icon: "⏰", label: "Set an alarm", description: "to follow up with my listing agent", prompt: "Set an alarm to follow up with my listing agent in 2 hours" },
    { icon: "📅", label: "Schedule reminder", description: "for my property visit tomorrow", prompt: "Schedule a reminder for my property visit tomorrow at 11 AM" },
    { icon: "✍️", label: "Draft an email", description: "negotiating rent for an apartment", prompt: "Draft a polite and professional email negotiating the rent for an apartment" },
    { icon: "🧮", label: "Calculate EMI", description: "estimate monthly loan payment", prompt: "Help me calculate the monthly EMI for a home loan of ₹50 Lakhs at 8.5% interest for 20 years" },
    { icon: "🧠", label: "Explain simply", description: "explain a complex real estate concept simply", prompt: "Explain a complex real estate concept (like FSI/FAR) in very simple terms" },
    { icon: "💡", label: "Staging ideas", description: "styling tips to stage a property on a budget", prompt: "Give me some creative ideas to stage a living room for sale on a budget" },
    { icon: "📝", label: "Summarize law", description: "summarize complex property acts or rules", prompt: "Summarize the key points of the RERA Act for property buyers" },
    { icon: "🔍", label: "Research green homes", description: "learn about sustainable building features", prompt: "Research the latest green building certifications and their value for homes" }
];

const DYNAMIC_GREETINGS = [
    "What's on your mind today?",
    "How can I assist with your real estate needs today?",
    "Looking for a home? Let's search together.",
    "Ready to find your next investment? Ask me anything.",
    "Need help scheduling visits or calculating loans?",
    "Hello! How can SetuAI help you today?"
];

const getRandomSuggestions = () => {
    const rePool = SUGG_TEMPLATES.slice(0, 8);
    const genPool = SUGG_TEMPLATES.slice(8);
    
    // Pick 3 random real estate suggestions
    const reSelected = [...rePool].sort(() => 0.5 - Math.random()).slice(0, 3);
    // Pick 3 random general suggestions
    const genSelected = [...genPool].sort(() => 0.5 - Math.random()).slice(0, 3);
    
    // Combine and shuffle them
    return [...reSelected, ...genSelected].sort(() => 0.5 - Math.random());
};

const THINKING_TAGS = [
    "Thinking...",
    "Analyzing query...",
    "Processing context...",
    "Retrieving information...",
    "Synthesizing response...",
    "Finalizing answer...",
    "Checking details...",
    "Almost ready...",
    "Final verification...",
    "Polishing results...",
    "Securing response...",
    "Ensuring accuracy..."
];

const ScrollingThinkingTags = ({ isHeader = false, isDarkMode = false, isScheduler = false, schedulerType = 'create', isDeepThinking = false, isWebSearch = false, mediaType = null }) => {
    const [index, setIndex] = useState(0);

    const schedulerTags = schedulerType === 'reschedule' ? [
        "Analyzing Query...",
        "Finding Active Reminders...",
        "Rescheduling Task...",
        "Finalizing Task Update..."
    ] : schedulerType === 'cancel' ? [
        "Analyzing Query...",
        "Identifying Target Task...",
        "Canceling Reminder...",
        "Finalizing Reminder Cancellation..."
    ] : [
        "Analyzing Query...",
        "Identifying Tasks...",
        "Creating Scheduled Tasks...",
        "Finalizing Task Creation..."
    ];

    const deepThinkingTags = [
        "Initiating deep thinking mode...",
        "Analyzing complex layers...",
        "Structuring reasoning steps...",
        "Exploring edge cases...",
        "Evaluating alternative paths...",
        "Formulating logical proofs...",
        "Refining conceptual model...",
        "Verifying structural validity...",
        "Synthesizing deep insights...",
        "Polishing final argument..."
    ];

    const webSearchTags = [
        "Accessing real estate indexes...",
        "Crawling web directories...",
        "Querying latest property listings...",
        "Retrieving market analysis...",
        "Comparing live database records...",
        "Synthesizing online findings...",
        "Filtering search results...",
        "Extracting relevant details...",
        "Validating source accuracy..."
    ];

    const imageTags = [
        "Analyzing image visual layers...",
        "Applying OCR text extraction...",
        "Running facial recognition...",
        "Detecting face landmarks...",
        "Matching known face descriptors...",
        "Identifying objects & layouts...",
        "Processing image metadata...",
        "Extracting visual highlights...",
        "Synthesizing image details...",
        "Formulating answer..."
    ];

    const videoTags = [
        "Analyzing video metadata...",
        "Deconstructing video frames...",
        "Processing audio-visual tracks...",
        "Detecting motion & scenes...",
        "Extracting frame segments...",
        "Synthesizing video sequence...",
        "Formulating answer..."
    ];

    const documentTags = [
        "Opening document stream...",
        "Parsing pages & layout...",
        "Extracting text & paragraphs...",
        "Detecting tables & data grids...",
        "Structuring page summaries...",
        "Synthesizing document insights...",
        "Formulating answer..."
    ];

    const codeTags = [
        "Parsing code syntax...",
        "Analyzing project dependencies...",
        "Mapping function execution flows...",
        "Evaluating class interfaces...",
        "Checking logical complexity...",
        "Formulating code solution..."
    ];

    const audioTags = [
        "Analyzing audio waveform...",
        "Decoding frequency channels...",
        "Running acoustic model...",
        "Synthesizing voice transcription...",
        "Extracting sound features...",
        "Formulating response..."
    ];

    let tagsToUse = THINKING_TAGS;
    if (isScheduler) {
        tagsToUse = schedulerTags;
    } else if (isDeepThinking) {
        tagsToUse = deepThinkingTags;
    } else if (isWebSearch) {
        tagsToUse = webSearchTags;
    } else if (mediaType === 'image') {
        tagsToUse = imageTags;
    } else if (mediaType === 'video') {
        tagsToUse = videoTags;
    } else if (mediaType === 'document') {
        tagsToUse = documentTags;
    } else if (mediaType === 'code') {
        tagsToUse = codeTags;
    } else if (mediaType === 'audio') {
        tagsToUse = audioTags;
    }

    useEffect(() => {
        setIndex(0);
    }, [isScheduler, schedulerType, isDeepThinking, isWebSearch, mediaType]);

    useEffect(() => {
        let timer;
        const processTags = () => {
            let delay = 4000;

            if (isScheduler) {
                delay = 2500; // Cycle slightly faster for scheduler
            } else if (isDeepThinking) {
                delay = 5000; // Think longer!
            } else if (isWebSearch) {
                delay = 3500; // Web search tags
            } else if (mediaType) {
                delay = 3000; // Media analysis tags
            } else if (index === 5) { // "Finalizing answer..."
                delay = 8000; // Stay much longer on this one
            } else if (index > 5) {
                delay = 6000; // Change very slowly for the "late" tags
            }

            // Ensure the last 2 tags in ANY active set change slowly (e.g., 6000ms - 8000ms delay)
            if (index >= tagsToUse.length - 2) {
                delay = index === tagsToUse.length - 2 ? 8000 : 6000;
            }

            timer = setTimeout(() => {
                setIndex((prev) => {
                    if (prev >= tagsToUse.length - 1) return prev;
                    return prev + 1;
                });
            }, delay);
        };

        processTags();
        return () => clearTimeout(timer);
    }, [index, isScheduler, schedulerType, isDeepThinking, isWebSearch, mediaType, tagsToUse.length]);

    return (
        <div className={`overflow-hidden h-6 relative inline-block flex-shrink-0 ${isHeader ? 'min-w-[150px] max-w-[280px]' : 'min-w-[220px] max-w-[280px]'} align-middle`}>
            <div
                className="transition-transform duration-1000 ease-in-out absolute inset-0 w-full flex flex-col"
                style={{ transform: `translateY(-${index * 24}px)` }}
            >
                {tagsToUse.map((tag, i) => (
                    <div
                        key={i}
                        className={`h-6 flex items-center flex-shrink-0 animate-fadeIn ${isHeader ? 'text-white/90 text-[10px] md:text-xs' : `${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-xs sm:text-sm`} font-medium whitespace-nowrap overflow-hidden text-ellipsis`}
                    >
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

const RecommendationSlider = ({ recommendations }) => {
    const scrollRef = React.useRef(null);
    const [showLeftArrow, setShowLeftArrow] = React.useState(false);
    const [showRightArrow, setShowRightArrow] = React.useState(true);
    const [numDots, setNumDots] = React.useState(0);
    const [activeDot, setActiveDot] = React.useState(0);

    const updateDots = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        
        setShowLeftArrow(scrollLeft > 10);
        setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);

        const cards = scrollRef.current.children;
        if (cards && cards.length > 0) {
            const cardWidth = cards[0].offsetWidth;
            const gap = 16; // gap-4 is 16px
            const step = cardWidth + gap;
            
            const maxScroll = scrollWidth - clientWidth;
            if (maxScroll <= 0) {
                setNumDots(0);
                setActiveDot(0);
                return;
            }

            const stepsCount = Math.round(maxScroll / step);
            const totalDots = stepsCount + 1;
            setNumDots(totalDots > 1 ? totalDots : 0);

            const currentStep = Math.round(scrollLeft / step);
            setActiveDot(Math.min(currentStep, stepsCount));
        }
    };

    const handleScroll = () => {
        updateDots();
    };

    React.useEffect(() => {
        const timer = setTimeout(() => {
            updateDots();
        }, 100);

        window.addEventListener('resize', updateDots);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateDots);
        };
    }, [recommendations]);

    const scrollDirection = (direction) => {
        if (!scrollRef.current) return;
        const cards = scrollRef.current.children;
        if (cards && cards.length > 0) {
            const cardWidth = cards[0].offsetWidth;
            const gap = 16;
            const step = cardWidth + gap;
            const currentScroll = scrollRef.current.scrollLeft;
            
            const targetScroll = direction === 'left' 
                ? currentScroll - step 
                : currentScroll + step;
                
            scrollRef.current.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
        }
    };

    const scrollToDot = (index) => {
        if (!scrollRef.current) return;
        const cards = scrollRef.current.children;
        if (cards && cards.length > 0) {
            const cardWidth = cards[0].offsetWidth;
            const gap = 16;
            const step = cardWidth + gap;
            scrollRef.current.scrollTo({
                left: index * step,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="relative group/slider select-none">
            {showLeftArrow && (
                <button
                    onClick={() => scrollDirection('left')}
                    className="absolute left-[-15px] sm:left-[-20px] top-1/2 -translate-y-1/2 z-10 w-8 h-8 hidden md:flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110 active:scale-90 cursor-pointer"
                    aria-label="Previous properties"
                >
                    <FaChevronLeft size={12} />
                </button>
            )}

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto pb-4 gap-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth snap-x snap-mandatory"
            >
                {recommendations.map((item, pIdx) => {
                    const isProperty = item.bedrooms !== undefined || item.bathrooms !== undefined || item.type === 'rent' || item.type === 'sale';
                    const isBlogGuide = item.category || item.excerpt || item.type === 'blog' || item.type === 'guide';

                    return (
                        <div key={item._id || pIdx} className="flex-shrink-0 w-[240px] snap-start transform transition-transform duration-300 hover:scale-[1.02]">
                            {isProperty ? (
                                <ListingItem listing={item} />
                            ) : isBlogGuide ? (
                                <BlogGuideItem item={item} type={item.type || 'blog'} />
                            ) : (
                                <ListingItem listing={item} />
                            )}
                        </div>
                    );
                })}
            </div>

            {showRightArrow && (
                <button
                    onClick={() => scrollDirection('right')}
                    className="absolute right-[-15px] sm:right-[-20px] top-1/2 -translate-y-1/2 z-10 w-8 h-8 hidden md:flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110 active:scale-90 cursor-pointer"
                    aria-label="Next properties"
                >
                    <FaChevronRight size={12} />
                </button>
            )}

            {/* Dynamic Dots Pagination */}
            {numDots > 1 && (
                <div className="flex justify-center items-center gap-1.5 mt-2">
                    {Array.from({ length: numDots }).map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => scrollToDot(idx)}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                activeDot === idx
                                    ? 'w-5 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 shadow-md shadow-blue-500/20'
                                    : 'w-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
                            }`}
                            aria-label={`Go to slide ${idx + 1}`}
                        />
                      ))}
                </div>
            )}
        </div>
    );
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
    const [messages, setMessages] = useState([]);
    const [messageHistoryPage, setMessageHistoryPage] = useState(1);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [isLoadingPreviousMessages, setIsLoadingPreviousMessages] = useState(false);
    const [totalMessageCount, setTotalMessageCount] = useState(0); // Tracks actual total messages from backend (not just loaded ones)
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCurrentRequestScheduler, setIsCurrentRequestScheduler] = useState(false);
    const [currentSchedulerType, setCurrentSchedulerType] = useState('create'); // 'create', 'reschedule', 'cancel'
    const [activeRetryMenu, setActiveRetryMenu] = useState(null);
    const [retryInstruction, setRetryInstruction] = useState('');
    const [isCurrentRequestDeepThinking, setIsCurrentRequestDeepThinking] = useState(false);
    const [isCurrentRequestWebSearch, setIsCurrentRequestWebSearch] = useState(false);
    const [prePromptPreference, setPrePromptPreference] = useState(null); // 'think' | 'search' | null
    const [isFaceApiLoading, setIsFaceApiLoading] = useState(false);
    const [isAnalyzingFaces, setIsAnalyzingFaces] = useState({}); // format: { [imgTempId]: boolean }
    const [detectedFaces, setDetectedFaces] = useState({}); // format: { [imgTempId]: [{ name: '...', descriptor: [...] }] }
    const [faceTaggingModal, setFaceTaggingModal] = useState({ isOpen: false, imgId: null, faceIndex: null, descriptor: null, name: '', details: '' });
    const [isFaceTagRefreshing, setIsFaceTagRefreshing] = useState(false);
    const urlFaceDescriptorsRef = useRef({}); // Cache for URL -> face descriptor mapping
    const [taggingSentImageLoading, setTaggingSentImageLoading] = useState({}); // format: { [imageUrl]: boolean }
    const [deleteReminderId, setDeleteReminderId] = useState(null);

    const handleFaceTagRefresh = async () => {
        if (!faceTaggingModal.imgId) return;
        const sessionId = getOrCreateSessionId();
        if (!sessionId) return;
        
        setIsFaceTagRefreshing(true);
        try {
            const fetchUrl = `${API_BASE_URL}/api/chat-history/session/${sessionId}/image-face-tags?imageUrl=${encodeURIComponent(faceTaggingModal.imgId)}`;
            const res = await authenticatedFetch(fetchUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.faceTags && data.faceTags.length > 0) {
                    const tag = data.faceTags[0];
                    setFaceTaggingModal(prev => ({
                        ...prev,
                        name: tag.name || '',
                        details: tag.details || ''
                    }));
                    toast.success("Successfully fetched face tag details from backend!");
                } else {
                    toast.info("No face tag details found for this image in the backend.");
                }
            } else {
                toast.error("Failed to fetch face tag details from backend.");
            }
        } catch (error) {
            console.error("Error refreshing face tag details:", error);
            toast.error("Failed to refresh face tag details.");
        } finally {
            setIsFaceTagRefreshing(false);
        }
    };

    // -------------------------------------------------------------
    // FACE RECOGNITION UTILITIES (face-api.js)
    // -------------------------------------------------------------
    const loadFaceApiModels = async () => {
        if (faceapi.nets.ssdMobilenetv1.params) return;
        setIsFaceApiLoading(true);
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
            console.log('🤖 Loading face-api.js models from CDN...');
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            console.log('✅ face-api.js models loaded successfully!');
        } catch (err) {
            console.error('❌ Failed to load face-api.js models:', err);
        } finally {
            setIsFaceApiLoading(false);
        }
    };

    const getKnownFaces = () => {
        try {
            const stored = localStorage.getItem('setu_known_faces');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error reading known faces:', e);
            return [];
        }
    };

    const registerFace = (name, descriptor, details = '') => {
        try {
            const knownFaces = getKnownFaces();
            const descArray = Array.from(descriptor);
            const entry = { name, descriptor: descArray };
            if (details && details.trim()) {
                entry.details = details.trim().slice(0, 200);
            }
            knownFaces.push(entry);
            localStorage.setItem('setu_known_faces', JSON.stringify(knownFaces));
            toast.success(`Registered face as "${name}"!`);
        } catch (e) {
            console.error('Failed to register face:', e);
            toast.error('Failed to save face registration.');
        }
    };

    const runFacialRecognition = async (url, tempId) => {
        setIsAnalyzingFaces(prev => ({ ...prev, [tempId]: true }));
        try {
            await loadFaceApiModels();
            console.log(`👁️ Running client-side face detection on ${url}...`);
            const img = await faceapi.fetchImage(url);
            const detections = await faceapi.detectAllFaces(img)
                .withFaceLandmarks()
                .withFaceDescriptors();
            
            console.log(`👤 Detections completed. Found ${detections ? detections.length : 0} face(s).`);
            
            if (detections && detections.length > 0) {
                const knownFaces = getKnownFaces();
                const results = detections.map(det => {
                    let bestMatch = { name: 'Unknown', details: '', distance: 1.0 };
                    knownFaces.forEach(known => {
                        const dist = faceapi.euclideanDistance(det.descriptor, new Float32Array(known.descriptor));
                        if (dist < 0.6 && dist < bestMatch.distance) {
                            bestMatch = { name: known.name, details: known.details || '', distance: dist };
                        }
                    });
                    return {
                        name: bestMatch.name,
                        details: bestMatch.details || '',
                        descriptor: Array.from(det.descriptor)
                    };
                });
                setDetectedFaces(prev => ({ ...prev, [tempId]: results }));
            } else {
                setDetectedFaces(prev => ({ ...prev, [tempId]: [] }));
            }
        } catch (err) {
            console.error('❌ Face recognition failed:', err);
        } finally {
            setIsAnalyzingFaces(prev => ({ ...prev, [tempId]: false }));
        }
    };

    const updateOcrTextFaceName = (ocrText, imgUrl, oldName, newName) => {
        if (!ocrText) return ocrText;
        const blocks = ocrText.split(/I've uploaded a image file:/);
        const updatedBlocks = blocks.map(block => {
            if (imgUrl && block.includes(imgUrl)) {
                const knownFacesForDetails = getKnownFaces();
                const knownEntry = knownFacesForDetails.find(kf => kf.name === newName);
                let faceDisplay = newName;
                if (knownEntry && knownEntry.details && knownEntry.details.trim()) {
                    faceDisplay = `${newName} (Details: ${knownEntry.details.trim()})`;
                }
                const faceMatch = block.match(/Identified Face\(s\)\/Person\(s\) in Image:\s*\n"""\s*\n([\s\S]*?)\n"""/);
                const newFaceStr = `Identified Face(s)/Person(s) in Image:\n"""\n${faceDisplay}\n"""`;
                if (faceMatch) {
                    return block.replace(/Identified Face\(s\)\/Person\(s\) in Image:\s*\n"""\s*\n([\s\S]*?)\n"""/, newFaceStr);
                } else {
                    return block + `\n\n${newFaceStr}`;
                }
            }
            return block;
        });
        return updatedBlocks.join("I've uploaded a image file:");
    };

    const parseFacesFromOcr = (ocrText, imgUrl) => {
        if (!ocrText) return [];
        const blocks = ocrText.split(/I've uploaded a image file:/);
        for (const block of blocks) {
            if (imgUrl && block.includes(imgUrl)) {
                const faceMatch = block.match(/Identified Face\(s\)\/Person\(s\) in Image:\s*\n"""\s*\n([\s\S]*?)\n"""/);
                if (faceMatch && faceMatch[1]) {
                    return faceMatch[1]
                        .split(',')
                        .map(n => {
                            const trimmed = n.trim();
                            const detailsIdx = trimmed.indexOf(' (Details:');
                            if (detailsIdx !== -1) {
                                return trimmed.substring(0, detailsIdx).trim();
                            }
                            return trimmed;
                        })
                        .filter(n => n && !n.includes('Face AI detected a face') && !n.includes('vision intelligence') && !n.startsWith('Unknown') && n !== 'Unknown');
                }
                return []; // Found block for this image, but no faces are present
            }
        }
        // Fallback for compatibility (only if no matching block was found at all)
        const faceMatch = ocrText.match(/Identified Face\(s\)\/Person\(s\) in Image:\s*\n"""\s*\n([\s\S]*?)\n"""/);
        if (faceMatch && faceMatch[1]) {
            return faceMatch[1]
                .split(',')
                .map(n => {
                    const trimmed = n.trim();
                    const detailsIdx = trimmed.indexOf(' (Details:');
                    if (detailsIdx !== -1) {
                        return trimmed.substring(0, detailsIdx).trim();
                    }
                    return trimmed;
                })
                .filter(n => n && !n.includes('Face AI detected a face') && !n.includes('vision intelligence') && !n.startsWith('Unknown') && n !== 'Unknown');
        }
        return [];
    };

    const hasUnknownFace = (ocrText, imgUrl) => {
        if (!ocrText) return false;
        const blocks = ocrText.split(/I've uploaded a image file:/);
        for (const block of blocks) {
            if (imgUrl && block.includes(imgUrl)) {
                return block.includes('Face AI detected a face') || block.includes('Identified Face');
            }
        }
        // Fallback for compatibility (only if no matching block was found at all)
        return ocrText.includes('Face AI detected a face') || ocrText.includes('Identified Face');
    };

    const handleSentImageTagClick = async (imgUrl, currentName, currentDetails = '') => {
        if (taggingSentImageLoading[imgUrl]) return;
        
        let descriptor = urlFaceDescriptorsRef.current[imgUrl];
        
        if (!descriptor) {
            setTaggingSentImageLoading(prev => ({ ...prev, [imgUrl]: true }));
            try {
                await loadFaceApiModels();
                const fetchUrl = imgUrl.startsWith('http') && !imgUrl.includes('localhost') && !imgUrl.includes('127.0.0.1')
                    ? `${API_BASE_URL}/api/upload/proxy-image?url=${encodeURIComponent(imgUrl)}`
                    : imgUrl;
                    
                const imgElement = await faceapi.fetchImage(fetchUrl);
                const detections = await faceapi.detectAllFaces(imgElement)
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                    
                if (detections && detections.length > 0) {
                    descriptor = detections[0].descriptor;
                    urlFaceDescriptorsRef.current[imgUrl] = descriptor;
                } else {
                    toast.error("No faces detected in this image to tag!");
                    return;
                }
            } catch (err) {
                console.error("Error detecting face from sent image:", err);
                toast.error("Failed to analyze faces on this image.");
                return;
            } finally {
                setTaggingSentImageLoading(prev => ({ ...prev, [imgUrl]: false }));
            }
        }
        
        setFaceTaggingModal({
            isOpen: true,
            imgId: imgUrl,
            faceIndex: 0,
            descriptor: descriptor,
            name: currentName || '',
            details: currentDetails || ''
        });
    };

    const handleFaceTagSubmit = (e) => {
        if (e) e.preventDefault();
        if (!faceTaggingModal.name.trim()) return;
        
        const newName = faceTaggingModal.name.trim();
        const newDetails = (faceTaggingModal.details || '').trim().slice(0, 200);
        registerFace(newName, faceTaggingModal.descriptor, newDetails);
        
        if (typeof faceTaggingModal.imgId === 'string' && (faceTaggingModal.imgId.startsWith('http') || faceTaggingModal.imgId.startsWith('/'))) {
            const imgUrl = faceTaggingModal.imgId;
            setMessages(prev => {
                const updated = prev.map(msg => {
                    if (msg.role === 'user' && msg.ocrText && msg.ocrText.includes(imgUrl)) {
                        const updatedOcr = updateOcrTextFaceName(msg.ocrText, imgUrl, null, newName);
                        
                        // Structured faceTags array management
                        const existingFaceTags = msg.faceTags || [];
                        const hasMatchingTag = existingFaceTags.some(ft => ft.name === newName);
                        let updatedFaceTags = [...existingFaceTags];
                        if (hasMatchingTag) {
                            updatedFaceTags = updatedFaceTags.map(ft =>
                                ft.name === newName ? { ...ft, details: newDetails } : ft
                            );
                        } else {
                            updatedFaceTags = [{
                                name: newName,
                                details: newDetails,
                                descriptor: Array.from(faceTaggingModal.descriptor || [])
                            }];
                        }
                        
                        return { ...msg, ocrText: updatedOcr, faceTags: updatedFaceTags };
                    }
                    return msg;
                });
                setTimeout(() => syncChatTreeToBackend(updated), 50);
                return updated;
            });
        } else {
            setDetectedFaces(prev => {
                const currentList = prev[faceTaggingModal.imgId] || [];
                const updatedList = currentList.map((item, idx) => 
                    idx === faceTaggingModal.faceIndex ? { ...item, name: newName, details: newDetails } : item
                );
                return { ...prev, [faceTaggingModal.imgId]: updatedList };
            });
        }
        
        setFaceTaggingModal({ isOpen: false, imgId: null, faceIndex: null, descriptor: null, name: '', details: '' });
    };
    // -------------------------------------------------------------
    const [sessionId, setSessionId] = useState(null);
    const [currentSuggestions, setCurrentSuggestions] = useState([]);
    const [currentGreeting, setCurrentGreeting] = useState('');
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
    const [ocrResults, setOcrResults] = useState({});
    const [isOcrExtracting, setIsOcrExtracting] = useState({});
    const [isExtractingText, setIsExtractingText] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState('');
    const [currentRequestMediaType, setCurrentRequestMediaType] = useState(null);
    const [tone, setTone] = useState(() => localStorage.getItem('gemini_tone') || 'neutral'); // modes dropdown (tone)
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const headerMenuButtonRef = useRef(null);
    const suggestionsRef = useRef(null);
    const headerMenuRef = useRef(null);
    const [showFeatures, setShowFeatures] = useState(false);
    const [showTryPrompt, setShowTryPrompt] = useState(false);
    const [hasShownPrompt, setHasShownPrompt] = useState(false);

    // Typewriter effect for input placeholder
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [placeholderSubIndex, setPlaceholderSubIndex] = useState(0);
    const [placeholderIsDeleting, setPlaceholderIsDeleting] = useState(false);
    const [placeholderText, setPlaceholderText] = useState("Ask anything...");
    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);

    useEffect(() => {
        if (!isOpen) return;

        const words = [
            "Ask anything...",
            "Schedule tasks...",
            "Add reminders...",
            "Find homes...",
            "Check rental...",
            "Compare loans...",
            "Ask legal help...",
            "Ask ESG index...",
            "Chat with SetuAI..."
        ];

        const word = words[placeholderIndex];

        if (placeholderSubIndex === word.length + 1 && !placeholderIsDeleting) {
            const timeout = setTimeout(() => {
                setPlaceholderIsDeleting(true);
            }, 2000);
            return () => clearTimeout(timeout);
        }

        if (placeholderSubIndex === 0 && placeholderIsDeleting) {
            setPlaceholderIsDeleting(false);
            setPlaceholderIndex((prev) => (prev + 1) % words.length);
            return;
        }

        const timeout = setTimeout(() => {
            const nextSub = placeholderSubIndex + (placeholderIsDeleting ? -1 : 1);
            setPlaceholderSubIndex(nextSub);
            setPlaceholderText(word.substring(0, nextSub));
        }, placeholderIsDeleting ? 50 : 100);

        return () => clearTimeout(timeout);
    }, [placeholderSubIndex, placeholderIndex, placeholderIsDeleting, isOpen]);

    // Read prompt from URL
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const promptParam = searchParams.get('prompt');
        if (promptParam) {
            setInputMessage(promptParam);
            const currentSessionId = sessionId || localStorage.getItem('gemini_session_id');
            if (currentSessionId) {
                localStorage.setItem(`gemini_draft_${currentSessionId}`, promptParam);
            }
            if (!isOpen) {
                setIsOpen(true);
            }
        }
    }, [location.search]);

    // Show promotional prompt on mount (only once)
    useEffect(() => {
        if (hasShownPrompt || isOpen) return;

        const timer = setTimeout(() => {
            setShowTryPrompt(true);
            setHasShownPrompt(true);
            // Hide after 6 seconds
            const hideTimer = setTimeout(() => setShowTryPrompt(false), 6000);
            return () => clearTimeout(hideTimer);
        }, 3000);
        return () => clearTimeout(timer);
    }, [isOpen, hasShownPrompt]);

    // Initialize or randomize suggestions and greeting for empty state
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setCurrentSuggestions(getRandomSuggestions());
            const randomGreeting = DYNAMIC_GREETINGS[Math.floor(Math.random() * DYNAMIC_GREETINGS.length)];
            setCurrentGreeting(randomGreeting);
        }
    }, [isOpen, sessionId, messages.length]);

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
    const originalTitleRef = useRef(document.title);
    const wasOpenRef = useRef(false);
    useEffect(() => {
        // Skip title handling if we are on a shared chat view page to avoid flickering/overwriting
        if (location.pathname.includes('/share/')) {
            return;
        }

        if (isOpen) {
            // Store original title if we haven't already (or update it if it's not a chat title)
            if (!document.title.includes(' - SetuAI') && document.title !== "AI Assistant - Smart Property Search") {
                originalTitleRef.current = document.title;
            }

            if (currentChatName && currentChatName !== 'New Chat' && !/^Chat \d/i.test(currentChatName)) {
                document.title = `${currentChatName} - SetuAI`;
            } else {
                document.title = "AI Assistant - Smart Property Search";
            }
            wasOpenRef.current = true;
        } else {
            // Restore original title only if it was actually opened first
            if (wasOpenRef.current && originalTitleRef.current) {
                document.title = originalTitleRef.current;
                wasOpenRef.current = false;
            }
        }
    }, [currentChatName, isOpen, location.pathname]);

    // Property suggestion states
    const [showPropertySuggestions, setShowPropertySuggestions] = useState(false);
    const [propertySuggestions, setPropertySuggestions] = useState([]);
    const [blogSuggestions, setBlogSuggestions] = useState([]);
    const [isLoadingBlogSuggestions, setIsLoadingBlogSuggestions] = useState(false);
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
    const [showCoinBurst, setShowCoinBurst] = useState(false);
    const [burstCount, setBurstCount] = useState(15);
    const [showSettings, setShowSettings] = useState(false);
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showReminders, setShowReminders] = useState(false);
    const [showReminderInfoModal, setShowReminderInfoModal] = useState(false);
    const [reminders, setReminders] = useState([]);
    const [activePage, setActivePage] = useState(1);
    const [pastPage, setPastPage] = useState(1);
    const [ringingReminderId, setRingingReminderId] = useState(window.activeRingingReminderId || null);
    const [isLoadingReminders, setIsLoadingReminders] = useState(false);
    const [isSchedulingReminder, setIsSchedulingReminder] = useState(false);
    const [isRescheduling, setIsRescheduling] = useState(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleText, setRescheduleText] = useState('');
    const [isCreatingReminder, setIsCreatingReminder] = useState(false);
    const [newReminderText, setNewReminderText] = useState('');
    const [newReminderDate, setNewReminderDate] = useState('');
    const [timeTicker, setTimeTicker] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeTicker(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const getDurationRemainingText = (scheduledTime) => {
        const diffMs = new Date(scheduledTime) - new Date();
        if (diffMs <= 0) return "Alert is now!";
        
        const diffSecs = Math.floor(diffMs / 1000);
        if (diffSecs < 60) {
            return `Alarm in ${diffSecs} second${diffSecs !== 1 ? 's' : ''}`;
        }
        
        const diffMins = Math.floor(diffSecs / 60);
        const days = Math.floor(diffMins / (24 * 60));
        const hours = Math.floor((diffMins % (24 * 60)) / 60);
        const minutes = diffMins % 60;
        
        let timeString = "Alarm in ";
        if (days > 0) {
            timeString += `${days} day${days > 1 ? 's' : ''} `;
        }
        if (hours > 0) {
            timeString += `${hours} hour${hours > 1 ? 's' : ''} `;
        }
        if (minutes > 0) {
            timeString += `${minutes} minute${minutes > 1 ? 's' : ''}`;
        }
        return timeString.trim();
    };

    const formatAlarmDate = (scheduledTime) => {
        const d = new Date(scheduledTime);
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        const day = d.getDate();
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        
        let hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12;
        
        return `${weekday}, ${day} ${month}, ${hours}:${minutes} ${ampm}`;
    };
    const [chatSessions, setChatSessions] = useState([]);
    const [lifetimeUsage, setLifetimeUsage] = useState({ totalTokens: 0 });
    const [activeSessionTokens, setActiveSessionTokens] = useState(0);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [isLoadingSessionHistory, setIsLoadingSessionHistory] = useState(false);
    const [isLoadingNewSession, setIsLoadingNewSession] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
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

    // Reminders Operations
    const getMinDateTime = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const localNow = new Date(now.getTime() - (offset * 60 * 1000));
        return localNow.toISOString().slice(0, 16);
    };

    useEffect(() => {
        const handleOpenReminders = () => {
            setIsOpen(true);
            setShowReminders(true);
        };
        window.addEventListener('openRemindersModal', handleOpenReminders);
        return () => window.removeEventListener('openRemindersModal', handleOpenReminders);
    }, []);

    useEffect(() => {
        const handleReminderRinging = (event) => {
            setRingingReminderId(event.detail.reminderId);
        };
        window.addEventListener('reminderRinging', handleReminderRinging);
        return () => window.removeEventListener('reminderRinging', handleReminderRinging);
    }, []);

    const fetchReminders = async () => {
        setIsLoadingReminders(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders`);
            if (res.ok) {
                const data = await res.json();
                setReminders(data.reminders || []);
            } else {
                toast.error("Failed to load reminders");
            }
        } catch (err) {
            console.error("Error fetching reminders:", err);
            toast.error("Network error loading reminders");
        } finally {
            setIsLoadingReminders(false);
        }
    };

    const handleSnoozeInline = async (reminderId) => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${reminderId}/snooze`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ minutes: 5 })
            });
            if (res.ok) {
                toast.success("Reminder snoozed for 5 minutes");
                window.activeRingingReminderId = null;
                window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
                fetchReminders();
            } else {
                toast.error("Failed to snooze reminder");
            }
        } catch (err) {
            console.error('Failed to snooze reminder:', err);
            toast.error("Error snoozing reminder");
        }
    };

    const handleDismissInline = async (reminderId) => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${reminderId}/dismiss`, {
                method: 'PATCH'
            });
            if (res.ok) {
                toast.success("Reminder dismissed");
                window.activeRingingReminderId = null;
                window.dispatchEvent(new CustomEvent('reminderRinging', { detail: { reminderId: null, isRinging: false } }));
                fetchReminders();
            } else {
                toast.error("Failed to dismiss reminder");
            }
        } catch (err) {
            console.error('Failed to dismiss reminder:', err);
            toast.error("Error dismissing reminder");
        }
    };

    const handleReschedule = async (id, newTime, newText) => {
        if (!newTime) {
            toast.warn("Please select a valid date and time.");
            return;
        }
        if (new Date(newTime) < new Date()) {
            toast.warn("Cannot reschedule to a past date or time.");
            return;
        }
        try {
            const utcTime = new Date(newTime).toISOString();
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${id}/reschedule`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ scheduledTime: utcTime, taskText: newText })
            });
            if (res.ok) {
                toast.success("Reminder rescheduled successfully");
                fetchReminders();
                setIsRescheduling(null);
                setRescheduleText('');
            } else {
                const errData = await res.json();
                toast.error(errData.message || "Failed to reschedule reminder");
            }
        } catch (err) {
            console.error("Error rescheduling reminder:", err);
            toast.error("Error rescheduling reminder");
        }
    };

    const handleCreateReminder = async (text, time) => {
        if (!text) {
            toast.warn("Please enter a reminder description.");
            return;
        }
        if (!time) {
            toast.warn("Please select a valid date and time.");
            return;
        }
        if (new Date(time) < new Date()) {
            toast.warn("Cannot schedule a reminder in the past.");
            return;
        }
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailyCount = reminders.filter(r => r.createdAt && new Date(r.createdAt) >= oneDayAgo).length;
        if (dailyCount >= 10) {
            toast.error("Daily reminder limit reached (10 reminders/day). Please try again after 24 hrs.");
            return;
        }

        setIsSchedulingReminder(true);
        try {
            const utcTime = new Date(time).toISOString();
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reminderText: text, scheduledTime: utcTime })
            });
            if (res.ok) {
                toast.success("Reminder scheduled successfully");
                fetchReminders();
                setIsCreatingReminder(false);
                setNewReminderText('');
                setNewReminderDate('');
            } else {
                const errData = await res.json();
                toast.error(errData.message || "Failed to schedule reminder");
            }
        } catch (err) {
            console.error("Error creating reminder:", err);
            toast.error("Error scheduling reminder");
        } finally {
            setIsSchedulingReminder(false);
        }
    };

    const handleDeleteReminder = async (id) => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success("Reminder cancelled successfully");
                fetchReminders();
            } else {
                const errData = await res.json();
                toast.error(errData.message || "Failed to cancel reminder");
            }
        } catch (err) {
            console.error("Error deleting reminder:", err);
            toast.error("Error cancelling reminder");
        }
    };

    useEffect(() => {
        if (showReminders && currentUser) {
            setActivePage(1);
            setPastPage(1);
            fetchReminders();
        }
    }, [showReminders, currentUser]);

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
    const [showImageLinkModal, setShowImageLinkModal] = useState(false);
    const [imageLinkInput, setImageLinkInput] = useState('');
    const [imageLinkUrls, setImageLinkUrls] = useState([]);
    const [renameInput, setRenameInput] = useState('');
    const [refreshingBookmarks, setRefreshingBookmarks] = useState(false);
    const [initialSettingsSnapshot, setInitialSettingsSnapshot] = useState(null);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isSyncingSettings, setIsSyncingSettings] = useState(false);
    const [showUnsavedSettingsModal, setShowUnsavedSettingsModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [openedTermsFromConsent, setOpenedTermsFromConsent] = useState(false);

    // Scroll States & Refs for Mobile View in Info and Terms Modals
    const [infoScrollAtTop, setInfoScrollAtTop] = useState(true);
    const [infoScrollAtBottom, setInfoScrollAtBottom] = useState(false);
    const infoModalContainerRef = useRef(null);

    const [termsScrollAtTop, setTermsScrollAtTop] = useState(true);
    const [termsScrollAtBottom, setTermsScrollAtBottom] = useState(false);
    const termsModalContainerRef = useRef(null);

    const updateInfoScrollState = () => {
        const el = infoModalContainerRef.current;
        if (el) {
            const isTop = el.scrollTop <= 2;
            const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            setInfoScrollAtTop(isTop);
            setInfoScrollAtBottom(isBottom);
        }
    };

    const updateTermsScrollState = () => {
        const el = termsModalContainerRef.current;
        if (el) {
            const isTop = el.scrollTop <= 2;
            const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            setTermsScrollAtTop(isTop);
            setTermsScrollAtBottom(isBottom);
        }
    };

    const handleInfoScroll = (e) => {
        const target = e.currentTarget;
        const isTop = target.scrollTop <= 2;
        const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 5;
        setInfoScrollAtTop(isTop);
        setInfoScrollAtBottom(isBottom);
    };

    const handleTermsScroll = (e) => {
        const target = e.currentTarget;
        const isTop = target.scrollTop <= 2;
        const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 5;
        setTermsScrollAtTop(isTop);
        setTermsScrollAtBottom(isBottom);
    };

    useEffect(() => {
        if (showInfoModal) {
            setInfoScrollAtTop(true);
            setInfoScrollAtBottom(false);
            const timer = setTimeout(() => {
                updateInfoScrollState();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showInfoModal]);

    useEffect(() => {
        if (showTermsModal) {
            setTermsScrollAtTop(true);
            setTermsScrollAtBottom(false);
            const timer = setTimeout(() => {
                updateTermsScrollState();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showTermsModal]);

    // Scroll States & Refs for Mobile View in Ratings & Feedback Modal
    const [ratingsScrollAtTop, setRatingsScrollAtTop] = useState(true);
    const [ratingsScrollAtBottom, setRatingsScrollAtBottom] = useState(false);
    const ratingsModalContainerRef = useRef(null);

    const updateRatingsScrollState = () => {
        const el = ratingsModalContainerRef.current;
        if (el) {
            const isTop = el.scrollTop <= 2;
            const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            setRatingsScrollAtTop(isTop);
            setRatingsScrollAtBottom(isBottom);
        }
    };

    const handleRatingsScroll = (e) => {
        const target = e.currentTarget;
        const isTop = target.scrollTop <= 2;
        const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 5;
        setRatingsScrollAtTop(isTop);
        setRatingsScrollAtBottom(isBottom);
    };

    useEffect(() => {
        if (showRatingsModal) {
            setRatingsScrollAtTop(true);
            setRatingsScrollAtBottom(false);
            const timer = setTimeout(() => {
                updateRatingsScrollState();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showRatingsModal]);
    
    // Scroll States & Refs for Mobile View in Feedback Details Modal
    const [ratingDetailScrollAtTop, setRatingDetailScrollAtTop] = useState(true);
    const [ratingDetailScrollAtBottom, setRatingDetailScrollAtBottom] = useState(false);
    const ratingDetailModalContainerRef = useRef(null);

    const updateRatingDetailScrollState = () => {
        const el = ratingDetailModalContainerRef.current;
        if (el) {
            const isTop = el.scrollTop <= 2;
            const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            setRatingDetailScrollAtTop(isTop);
            setRatingDetailScrollAtBottom(isBottom);
        }
    };

    const handleRatingDetailScroll = (e) => {
        const target = e.currentTarget;
        const isTop = target.scrollTop <= 2;
        const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 5;
        setRatingDetailScrollAtTop(isTop);
        setRatingDetailScrollAtBottom(isBottom);
    };

    useEffect(() => {
        if (showRatingDetailModal && selectedRating) {
            setRatingDetailScrollAtTop(true);
            setRatingDetailScrollAtBottom(false);
            const timer = setTimeout(() => {
                updateRatingDetailScrollState();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showRatingDetailModal, selectedRating]);

    // Scroll States & Refs for Mobile View in Report Details Modal
    const [reportDetailScrollAtTop, setReportDetailScrollAtTop] = useState(true);
    const [reportDetailScrollAtBottom, setReportDetailScrollAtBottom] = useState(false);
    const reportDetailModalContainerRef = useRef(null);

    const updateReportDetailScrollState = () => {
        const el = reportDetailModalContainerRef.current;
        if (el) {
            const isTop = el.scrollTop <= 2;
            const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            setReportDetailScrollAtTop(isTop);
            setReportDetailScrollAtBottom(isBottom);
        }
    };

    const handleReportDetailScroll = (e) => {
        const target = e.currentTarget;
        const isTop = target.scrollTop <= 2;
        const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 5;
        setReportDetailScrollAtTop(isTop);
        setReportDetailScrollAtBottom(isBottom);
    };

    useEffect(() => {
        if (showReportDetailModal && selectedReportDetail) {
            setReportDetailScrollAtTop(true);
            setReportDetailScrollAtBottom(false);
            const timer = setTimeout(() => {
                updateReportDetailScrollState();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showReportDetailModal, selectedReportDetail]);


    // Safety Policy Violation & Cooldown State
    const VIOLATION_LIMIT = 3;
    const COOLDOWN_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    const VIOLATION_WINDOW = 24 * 60 * 60 * 1000; // 24-hour rolling window for all violations

    // Initialize violations with 24-hour window check
    const [policyViolations, setPolicyViolations] = useState(() => {
        const stored = parseInt(localStorage.getItem(getUserKey('policy_violations')) || '0');
        const windowStart = parseInt(localStorage.getItem(getUserKey('violation_window_start')) || '0');
        // If the 24-hour window has passed, reset violations regardless of count
        if (windowStart > 0 && Date.now() - windowStart >= VIOLATION_WINDOW) {
            localStorage.setItem(getUserKey('policy_violations'), '0');
            localStorage.removeItem(getUserKey('violation_window_start'));
            return 0;
        }
        return stored;
    });
    const [cooldownEnd, setCooldownEnd] = useState(() => {
        return parseInt(localStorage.getItem(getUserKey('cooldown_end')) || '0');
    });
    const [isBlockedByPolicy, setIsBlockedByPolicy] = useState(false);
    const [showViolationModal, setShowViolationModal] = useState(false);
    const [remainingCooldownText, setRemainingCooldownText] = useState('');

    // Sync violation states and handle cooldown check + 24hr rolling window reset
    useEffect(() => {
        const checkCooldown = () => {
            const now = Date.now();

            // --- 24-hour rolling window reset (applies to ALL violation counts) ---
            const windowStart = parseInt(localStorage.getItem(getUserKey('violation_window_start')) || '0');
            if (windowStart > 0 && now - windowStart >= VIOLATION_WINDOW && !isBlockedByPolicy) {
                // Window expired and user is NOT in active cooldown — reset violations
                setPolicyViolations(0);
                localStorage.setItem(getUserKey('policy_violations'), '0');
                localStorage.removeItem(getUserKey('violation_window_start'));
            }

            // --- Active 24hr block cooldown (when user hit 3/3) ---
            if (cooldownEnd > 0 && now < cooldownEnd) {
                if (!isBlockedByPolicy) setIsBlockedByPolicy(true);

                // Calculate remaining time
                const diff = cooldownEnd - now;
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                if (hours > 0) {
                    setRemainingCooldownText(`${hours}h ${minutes}m left`);
                } else if (minutes > 0) {
                    setRemainingCooldownText(`${minutes}m left`);
                } else {
                    setRemainingCooldownText('Ending soon...');
                }
            } else {
                if (isBlockedByPolicy) {
                    setIsBlockedByPolicy(false);
                    // Reset on expiry
                    setPolicyViolations(0);
                    localStorage.setItem(getUserKey('policy_violations'), '0');
                    localStorage.removeItem(getUserKey('cooldown_end'));
                    localStorage.removeItem(getUserKey('violation_window_start'));
                    setRemainingCooldownText('');
                }
            }
        };

        checkCooldown();
        const timer = setInterval(checkCooldown, 30000); // Check every 30s
        return () => clearInterval(timer);
    }, [cooldownEnd, isBlockedByPolicy, currentUser]);

    // Track policy violations and trigger block if needed
    const handlePolicyViolation = () => {
        const newCount = policyViolations + 1;
        setPolicyViolations(newCount);
        localStorage.setItem(getUserKey('policy_violations'), newCount.toString());

        // Start (or keep) the 24-hour violation window from the FIRST violation
        const existingWindow = localStorage.getItem(getUserKey('violation_window_start'));
        if (!existingWindow || existingWindow === '0') {
            localStorage.setItem(getUserKey('violation_window_start'), Date.now().toString());
        }

        if (newCount >= VIOLATION_LIMIT) {
            const endTime = Date.now() + COOLDOWN_DURATION;
            setCooldownEnd(endTime);
            localStorage.setItem(getUserKey('cooldown_end'), endTime.toString());
            setIsBlockedByPolicy(true);
            setShowViolationModal(true);
            setHasChatError(true);
        }
    };

    // Sync policy status with backend
    const fetchPolicyStatus = async () => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/policy-status`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.status) {
                    const { isBlocked, violations, cooldownEnd: serverCooldown } = data.status;

                    setPolicyViolations(violations);
                    if (isBlocked && serverCooldown) {
                        const endMs = new Date(serverCooldown).getTime();
                        setCooldownEnd(endMs);
                        setIsBlockedByPolicy(true);
                        setShowViolationModal(true); // Show modal on mount if blocked

                        // Sync localStorage
                        localStorage.setItem(getUserKey('policy_violations'), violations.toString());
                        localStorage.setItem(getUserKey('cooldown_end'), endMs.toString());
                    } else if (isBlockedByPolicy && !isBlocked) {
                        setIsBlockedByPolicy(false);
                        setCooldownEnd(0);
                        localStorage.removeItem(getUserKey('cooldown_end'));
                    }
                }
            }
        } catch (error) {
            console.error('Failed to sync policy status:', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchPolicyStatus();
        }
    }, [isOpen, currentUser]);
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
        "Compare 2BHK vs 3BHK apartments",
        "Schedule a reminder for my property visit tomorrow at 10 AM",
        "Set an alarm to follow up with the listing agent on Friday at 5 PM"
    ]);
    const [isLoadingMoreSuggestions, setIsLoadingMoreSuggestions] = useState(false);
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

    // Suggestions load limit states
    const [suggestionLoadCount, setSuggestionLoadCount] = useState(0);
    const [canLoadMoreSuggestions, setCanLoadMoreSuggestions] = useState(true);

    // Reset suggestion load count after 1 minute of inactivity
    useEffect(() => {
        if (suggestionLoadCount > 0) {
            const timer = setTimeout(() => {
                setSuggestionLoadCount(0);
                setCanLoadMoreSuggestions(true);
            }, 60000); // 1 minute reset
            return () => clearTimeout(timer);
        }
    }, [suggestionLoadCount]);
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
    const [temperature, setTemperature] = useState(() => getUserSetting('gemini_temperature', '0.5'));
    const [topP, setTopP] = useState(() => getUserSetting('gemini_top_p', '0.7'));
    const [topK, setTopK] = useState(() => getUserSetting('gemini_top_k', '40'));
    const [maxTokens, setMaxTokens] = useState(() => getUserSetting('gemini_max_tokens', '2048'));
    const [enableStreaming, setEnableStreaming] = useState(() => {
        // For public users, default to 'false', for logged-in users use saved setting or 'true'
        if (!currentUser) return false;
        return getUserSetting('gemini_streaming', 'true') !== 'false';
    });
    const [enableContextMemory, setEnableContextMemory] = useState(() => getUserSetting('gemini_context_memory', 'true') !== 'false');
    const [contextWindow, setContextWindow] = useState(() => getUserSetting('gemini_context_window', '4'));
    const [enableSystemPrompts, setEnableSystemPrompts] = useState(() => getUserSetting('gemini_system_prompts', 'true') !== 'false');

    // Image Auditing Hook (Extended from CreateListing)
    const { performAudit, auditByUrl, auditResults, isAuditing } = useImageAuditor();

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
    const [editingMessageImages, setEditingMessageImages] = useState([]);
    const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);

    // Image Upload & Preview State
    const [pendingImages, setPendingImages] = useState([]); // Array of {id, url, name, type, uploading}
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState([]);
    const [previewImageIndex, setPreviewImageIndex] = useState(0);
    const [isDraggingOver, setIsDraggingOver] = useState(false); // Drag-and-drop visual feedback
    const dragCounterRef = React.useRef(0); // Track nested drag enter/leave events

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

    // Scroll States & Refs for Mobile View in Message Reports Modal
    const [adminReportsScrollAtTop, setAdminReportsScrollAtTop] = useState(true);
    const [adminReportsScrollAtBottom, setAdminReportsScrollAtBottom] = useState(false);
    const adminReportsModalContainerRef = useRef(null);

    const updateAdminReportsScrollState = () => {
        const el = adminReportsModalContainerRef.current;
        if (el) {
            const isTop = el.scrollTop <= 2;
            const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
            setAdminReportsScrollAtTop(isTop);
            setAdminReportsScrollAtBottom(isBottom);
        }
    };

    const handleAdminReportsScroll = (e) => {
        const target = e.currentTarget;
        const isTop = target.scrollTop <= 2;
        const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 5;
        setAdminReportsScrollAtTop(isTop);
        setAdminReportsScrollAtBottom(isBottom);
    };

    useEffect(() => {
        if (showAdminReportsModal) {
            setAdminReportsScrollAtTop(true);
            setAdminReportsScrollAtBottom(false);
            const timer = setTimeout(() => {
                updateAdminReportsScrollState();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showAdminReportsModal]);

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
            if (activeRetryMenu !== null && !event.target.closest('.retry-menu-container')) {
                setActiveRetryMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openMessageMenuIndex, showInputOptions, activeRetryMenu]);

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
                            setMessages([]);
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

    // Apply per-chat settings from session data
    const applySessionSettings = (sessionSettings) => {
        if (!sessionSettings || typeof sessionSettings !== 'object') return;
        if (sessionSettings.messageLimit !== undefined && sessionSettings.messageLimit !== null) {
            setMessageLimit(sessionSettings.messageLimit);
        }
        if (sessionSettings.dataRetention !== undefined && sessionSettings.dataRetention !== null) {
            setDataRetention(sessionSettings.dataRetention);
        }
        if (sessionSettings.tone !== undefined && sessionSettings.tone !== null) {
            setTone(sessionSettings.tone);
        }
        if (sessionSettings.responseLength !== undefined && sessionSettings.responseLength !== null) {
            setAiResponseLength(sessionSettings.responseLength);
        }
        if (sessionSettings.creativity !== undefined && sessionSettings.creativity !== null) {
            setAiCreativity(sessionSettings.creativity);
        }
        if (sessionSettings.temperature !== undefined && sessionSettings.temperature !== null) {
            setTemperature(parseFloat(sessionSettings.temperature));
        }
        if (sessionSettings.topP !== undefined && sessionSettings.topP !== null) {
            setTopP(parseFloat(sessionSettings.topP));
        }
        if (sessionSettings.contextWindow !== undefined && sessionSettings.contextWindow !== null) {
            setContextWindow(sessionSettings.contextWindow);
        }
        if (sessionSettings.enableStreaming !== undefined) {
            setEnableStreaming(sessionSettings.enableStreaming === 'true' || sessionSettings.enableStreaming === true);
        }
    };

    const loadChatHistory = async (currentSessionId, page = 1) => {
        if (!currentUser || !currentSessionId) return;

        // Capture container and scroll height BEFORE loading state changes to handle tag removal correctly
        const container = messagesContainerRef.current;
        const scrollHeightBefore = container ? container.scrollHeight : 0;

        setIsLoadingPreviousMessages(true);

        try {
            const limit = 20;
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}?page=${page}&limit=${limit}`, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.messages && Array.isArray(data.data.messages)) {
                    const newMessages = data.data.messages;

                    // Store the actual total message count from backend
                    if (data.data.totalMessages !== undefined) {
                        setTotalMessageCount(data.data.totalMessages);
                        console.log('Total message count from backend:', data.data.totalMessages);
                    }

                    if (page === 1) {
                        setMessages(newMessages);
                        setMessageHistoryPage(1);
                        setIsLoadingPreviousMessages(false);

                        // Load chat name from the response
                        if (data.data.name && !/^Chat \d/i.test(data.data.name) && data.data.name.toLowerCase() !== 'new chat') {
                            setCurrentChatName(data.data.name);
                        }

                        // Apply per-chat settings from the session
                        if (data.data.settings) {
                            applySessionSettings(data.data.settings);
                        }
                    } else {
                        // Prepend older history
                        setMessages(prev => [...newMessages, ...prev]);
                        setMessageHistoryPage(page);
                        setIsLoadingPreviousMessages(false);

                        // Use multiple ticks to ensure DOM has reflected both message prepend AND loading tag removal
                        setTimeout(() => {
                            if (container) {
                                const scrollHeightAfter = container.scrollHeight;
                                const heightAdded = scrollHeightAfter - scrollHeightBefore;
                                // Adjust scroll to stay at same relative content position
                                // This prevents the chat from jumping when historical messages or loading tags are added/removed
                                container.scrollTop = container.scrollTop + heightAdded;
                            }
                        }, 50);
                    }

                    setHasMoreHistory(data.data.hasMore);
                    console.log(`Session history loaded (Page ${page}):`, newMessages.length, 'messages, Total:', data.data.totalMessages);
                }
            } else if (response.status === 404 && page === 1) {
                console.log('No session history found');
                setHasMoreHistory(false);
                setIsLoadingPreviousMessages(false);
            }
        } catch (error) {
            console.error('Error loading session history:', error);
            setIsLoadingPreviousMessages(false);
        } finally {
            // Only set loaded to true if it was page 1
            if (page === 1) {
                setIsHistoryLoaded(true);
            }
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
        setMessages([]);
        setFloatingDateLabel('');
        setIsScrolling(false);
        setTotalMessageCount(0); // Reset total message count for new session
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

            // Use a limit that covers current message count plus some buffer (min 50)
            // This ensures we get new messages without losing the current history depth
            const fetchLimit = Math.max(50, messages.length + 10);
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}?limit=${fetchLimit}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.messages) {
                    let serverMessages = data.data.messages;

                    // Apply per-chat settings if available in the refresh response
                    if (data.data.settings) {
                        applySessionSettings(data.data.settings);
                    }

                    // Check if AI is answering (loading) and merge active messages
                    let activeLocal = [];
                    if (isLoading) {
                        const lastMsg = messages[messages.length - 1];
                        if (lastMsg) {
                            if (lastMsg.role === 'assistant') {
                                activeLocal = messages.slice(-2);
                            } else if (lastMsg.role === 'user') {
                                activeLocal = messages.slice(-1);
                            }
                        }
                    }

                    // Check if the user message in activeLocal is already in serverMessages
                    const activeUserMsg = activeLocal.find(m => m.role === 'user');
                    let isUserMsgSaved = false;
                    if (activeUserMsg && serverMessages.length > 0) {
                        const lastServerMsg = serverMessages[serverMessages.length - 1];
                        isUserMsgSaved = lastServerMsg && 
                                           lastServerMsg.role === 'user' && 
                                           lastServerMsg.content === activeUserMsg.content;
                    }

                    // If user message is already saved by backend, remove it from activeLocal to prevent duplicates
                    const finalActiveLocal = isUserMsgSaved && activeUserMsg
                        ? activeLocal.filter(m => m !== activeUserMsg)
                        : activeLocal;

                    const finalMessages = [...serverMessages, ...finalActiveLocal];

                    const currentMessageCount = messages.length;
                    const diff = finalMessages.length - currentMessageCount;

                    if (diff !== 0) {
                        setMessages(finalMessages);
                        if (diff > 0) {
                            toast.success(`Messages refreshed! ${diff} new messages loaded.`);
                        } else {
                            toast.success('Messages synced with server.');
                        }
                    } else {
                        // Check if any messages have been updated
                        let hasUpdates = false;
                        for (let i = 0; i < finalMessages.length; i++) {
                            if (finalMessages[i].content !== messages[i]?.content ||
                                finalMessages[i].timestamp !== messages[i]?.timestamp ||
                                finalMessages[i].isStreaming !== messages[i]?.isStreaming) {
                                hasUpdates = true;
                                break;
                            }
                        }

                        if (hasUpdates) {
                            setMessages(finalMessages);
                            toast.success('Messages refreshed! Updates loaded.');
                        } else {
                            toast.info('Messages are already up to date.');
                        }
                    }

                    // Also sync the chat name if available
                    if (data.data.name && !/^Chat \d/i.test(data.data.name) && data.data.name.toLowerCase() !== 'new chat') {
                        setCurrentChatName(data.data.name);
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

    // Search blogs and guides for @ suggestions
    const searchBlogs = async (query) => {
        try {
            setIsLoadingBlogSuggestions(true);
            const searchQuery = query ? query.trim() : '';

            // Using the existing getBlogs endpoint with search param
            const url = `${API_BASE_URL}/api/blogs?search=${encodeURIComponent(searchQuery)}&limit=5&type=all&published=true`;

            const response = await authenticatedFetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Ensure we handle both data and data.data if API format varies, but controller says data.data
                setBlogSuggestions(data.data || data || []);
            } else {
                setBlogSuggestions([]);
            }
        } catch (error) {
            setBlogSuggestions([]);
        } finally {
            setIsLoadingBlogSuggestions(false);
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
                searchBlogs(textAfterAt);
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

        const itemTitle = property.name || property.title || 'Content';
        const newMessage = `${beforeAt}@${itemTitle}${afterAt}`;
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

                // Search properties and blogs
                searchProperties(textAfterAt);
                searchBlogs(textAfterAt);
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

        const itemTitle = property.name || property.title || 'Content';
        const newMessage = `${beforeAt}@${itemTitle}${afterAt}`;
        setInputMessage(newMessage);

        // Add property/blog to selected properties (which acts as selected content)
        setSelectedProperties(prev => {
            const exists = prev.some(p => (p.id || p._id || p.id) === (property.id || property._id));
            if (exists) return prev;
            return [...prev, property];
        });

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
        const combinedSuggestions = [...propertySuggestions, ...blogSuggestions];
        if (combinedSuggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < combinedSuggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev > 0 ? prev - 1 : combinedSuggestions.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && combinedSuggestions[selectedSuggestionIndex]) {
                    handleSuggestionSelect(combinedSuggestions[selectedSuggestionIndex]);
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

    const lastMessageRef = useRef(null);
    useEffect(() => {
        if (messages && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            // Only auto-scroll to bottom if the last message is new/changed
            // This prevents scrolling to bottom when prepending history
            if (lastMsg && (lastMsg.content !== lastMessageRef.current?.content || lastMsg.role !== lastMessageRef.current?.role)) {
                scrollToBottom();
                lastMessageRef.current = lastMsg;
            }
        }
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

    const acceptTerms = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
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

    const handleCloseTermsModal = () => {
        setShowTermsModal(false);
        if (openedTermsFromConsent) {
            setShowConsentModal(true);
            setOpenedTermsFromConsent(false);
        }
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

    // Sync settings when the settings modal is opened
    useEffect(() => {
        if (showSettings && currentUser) {
            handleSettingsSync(true); // Silent sync on open
        }
    }, [showSettings]);

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
        const isForever = dataRetention === '0' || dataRetention === 0 || dataRetention === 'forever';
        // Only run cleanup if dataRetention is a valid value and NOT forever
        if (dataRetention && !isForever && !isNaN(parseInt(dataRetention))) {
            cleanupOldData();
        }

        // Set up periodic cleanup (every hour) - only if data retention is enabled and not forever
        if (dataRetention && !isForever) {
            const cleanupInterval = setInterval(() => {
                if (dataRetention && !isForever && !isNaN(parseInt(dataRetention))) {
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

    // Keyboard shortcuts: Ctrl+/ focus, Esc close, and bottom menu options
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
            } else {
                const isCtrl = event.ctrlKey || event.metaKey;
                const isShift = event.shiftKey;

                // 1. Upload File: Ctrl+U
                if (isCtrl && !isShift && event.key.toLowerCase() === 'u') {
                    event.preventDefault();
                    if (isBlockedByPolicy) {
                        toast.warning('File upload is disabled during your policy cooldown.');
                        return;
                    }
                    if (!currentUser) {
                        toast.info('Please login to upload files');
                        return;
                    }
                    setShowFileUpload(true);
                }
                // 2. Voice Input: Ctrl+Shift+A
                else if (isCtrl && isShift && event.key.toLowerCase() === 'a') {
                    event.preventDefault();
                    if (isBlockedByPolicy) {
                        toast.warning('Voice input is disabled during your policy cooldown.');
                        return;
                    }
                    toggleVoiceInput();
                }
                // 3. Image Link: Ctrl+Shift+I
                else if (isCtrl && isShift && event.key.toLowerCase() === 'i') {
                    event.preventDefault();
                    if (isBlockedByPolicy) {
                        toast.warning('Image auditing is disabled during your policy cooldown.');
                        return;
                    }
                    if (!currentUser) {
                        toast.info('Please login to use image link');
                        return;
                    }
                    setShowImageLinkModal(true);
                }
                // 4. Think longer: Ctrl+Shift+M
                else if (isCtrl && isShift && event.key.toLowerCase() === 'm') {
                    event.preventDefault();
                    if (!currentUser) {
                        toast.info('Please Login to use these Premium Features');
                        return;
                    }
                    setPrePromptPreference(prev => prev === 'think' ? null : 'think');
                }
                // 5. Search the web: Ctrl+Shift+S
                else if (isCtrl && isShift && event.key.toLowerCase() === 's') {
                    event.preventDefault();
                    if (!currentUser) {
                        toast.info('Please Login to use these Premium Features');
                        return;
                    }
                    setPrePromptPreference(prev => prev === 'search' ? null : 'search');
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, currentUser, isBlockedByPolicy, toggleVoiceInput]);

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

    // Unified initial scroll to bottom logic
    const hasInitialScrolled = useRef(false);
    useEffect(() => {
        if (isOpen && isHistoryLoaded && !hasInitialScrolled.current) {
            setTimeout(() => {
                scrollToBottomInstant();
                hasInitialScrolled.current = true;
            }, 100);
        }
        // Reset flag when closed so it triggers again on next open
        if (!isOpen) {
            hasInitialScrolled.current = false;
        }
    }, [isOpen, isHistoryLoaded]);

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
            } else {
                setFloatingDateLabel('');
            }
        };
        compute();
        const onScroll = () => {
            compute();

            // Show floating date when scrolling starts
            setIsScrolling(true);

            // Check for scroll near top to load previous messages
            // Threshold increased to 30px for better reliability
            if (el.scrollTop <= 30 && hasMoreHistory && !isLoadingPreviousMessages) {
                console.log('Loading previous messages...');
                const currentSessionId = sessionId || localStorage.getItem('gemini_session_id');
                if (currentSessionId) {
                    loadChatHistory(currentSessionId, messageHistoryPage + 1);
                }
            }

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
    }, [isOpen, messages, hasMoreHistory, messageHistoryPage, isLoadingPreviousMessages, sessionId]);

    const handlePaste = async (e) => {
        if (isBlockedByPolicy) return;
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
        if (!items) return;

        const imageFiles = [];
        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                const blob = item.getAsFile();
                if (blob) imageFiles.push(blob);
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            if (!currentUser) {
                toast.info('Please login to upload files');
                return;
            }
            await uploadFilesAndSend(imageFiles);
        }
    };

    // Drag and Drop handlers for the input area
    const handleDragOver = (e) => {
        if (!enableDragAndDrop) return;
        if (isBlockedByPolicy) return;
        e.preventDefault();
        e.stopPropagation();
        // Set the drop effect to show a copy cursor
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragEnter = (e) => {
        if (!enableDragAndDrop) return;
        if (isBlockedByPolicy) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        // Only show overlay if files are being dragged (not text)
        if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e) => {
        if (!enableDragAndDrop) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current === 0) {
            setIsDraggingOver(false);
        }
    };

    const handleDrop = async (e) => {
        if (!enableDragAndDrop) return;
        if (isBlockedByPolicy) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        dragCounterRef.current = 0;

        if (!currentUser) {
            toast.info('Please login to upload files');
            return;
        }

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // Filter to supported file types (same as handleFileUpload)
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        const validAudioTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/x-aac', 'audio/ogg', 'audio/webm'];
        const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/mkv', 'video/quicktime', 'video/x-matroska'];
        const validDocTypes = ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'];
        const allValidTypes = [...validImageTypes, ...validAudioTypes, ...validVideoTypes, ...validDocTypes];
        const maxSize = 10 * 1024 * 1024; // 10MB

        const validFiles = [];
        const rejectedFiles = [];

        files.forEach(file => {
            const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
            const isImage = validImageTypes.includes(file.type) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
            const isAudio = validAudioTypes.includes(file.type) || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'].includes(ext);
            const isVideo = validVideoTypes.includes(file.type) || ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
            const isDoc = validDocTypes.includes(file.type) || ['pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'pptx', 'ppt'].includes(ext);

            if (file.size > maxSize) {
                rejectedFiles.push(`${file.name} (too large - max 10MB)`);
            } else if (!(isImage || isAudio || isVideo || isDoc)) {
                rejectedFiles.push(`${file.name} (unsupported format)`);
            } else {
                validFiles.push(file);
            }
        });

        if (rejectedFiles.length > 0) {
            toast.error(`Rejected: ${rejectedFiles.join(', ')}`);
        }

        if (validFiles.length > 0) {
            await uploadFilesAndSend(validFiles);
            toast.success(`📎 ${validFiles.length} file${validFiles.length > 1 ? 's' : ''} dropped — uploading now!`, { autoClose: 2000, toastId: 'drop-upload' });
        }
    };

    const handleSubmit = async (e, customMessage = null) => {
        if (e) e.preventDefault();

        // Cooldown/Policy Block check
        if (isBlockedByPolicy) {
            setShowViolationModal(true);
            return;
        }

        const activeMessage = customMessage !== null ? customMessage : inputMessage;

        // Allow submission if there's text OR pending images (image-only messages are valid)
        if ((!activeMessage.trim() && pendingImages.length === 0) || isLoading) return;

        // Check if images are still uploading
        if (pendingImages.length > 0) {
            const stillUploading = pendingImages.some(img => img.uploading);
            if (stillUploading) {
                toast.warning('⏳ Please wait — your images are still uploading. They\'ll be ready in a moment!', { autoClose: 4000, toastId: 'img-upload-wait' });
                return;
            }

            // Check if images are still being audited by Sentinel
            // isAuditing is an object { "chat_<id>": true/false }, NOT a boolean
            // Only block if an audit is actively running; if it finished (even with no result), allow sending
            const anyStillAuditing = pendingImages.some(img => isAuditing[`chat_${img.id}`] === true);
            if (anyStillAuditing) {
                toast.warning('🔍 Please wait — Sentinel is scanning your images for safety & quality. Almost done!', { autoClose: 4000, toastId: 'img-audit-wait' });
                return;
            }

            // Block images that Sentinel has rejected (e.g. nudity, violence)
            const rejectedImage = pendingImages.find(img => {
                const audit = auditResults[`chat_${img.id}`];
                return audit && audit.classification && audit.classification.status === 'Rejected';
            });

            if (rejectedImage) {
                const audit = auditResults[`chat_${rejectedImage.id}`];
                toast.error(`🚫 Security Alert: ${audit.classification.reason}`, {
                    autoClose: 5000,
                    toastId: 'sentinel-rejection'
                });
                // Optional: show a suspicious activity bubble in chat? 
                // For now, just blocking the submission and warning the user.
                return;
            }
        }

        // Check message limit (skip if unlimited)
        // Use totalMessageCount (from backend) for accurate enforcement, even when history is lazy-loaded
        if (messageLimit !== 'unlimited') {
            const messageLimitNum = parseInt(messageLimit);
            if (!isNaN(messageLimitNum) && messageLimitNum > 0) {
                // Use the larger of totalMessageCount and messages.length for accurate enforcement
                const actualMessageCount = Math.max(totalMessageCount, messages.length);
                if (actualMessageCount >= messageLimitNum) {
                    toast.error(
                        `🚫 Message limit reached (${actualMessageCount}/${messageLimitNum} messages). You can increase your message limit from the ⚙️ Themes & Settings panel, or start a new chat session.`,
                        { autoClose: 6000 }
                    );
                    return;
                }
                // Warn user when approaching the limit (within 5 messages)
                const remaining = messageLimitNum - actualMessageCount;
                if (remaining > 0 && remaining <= 5) {
                    toast.warn(
                        `⚠️ You have ${remaining} message${remaining === 1 ? '' : 's'} left in this session (${actualMessageCount}/${messageLimitNum}). Extend your limit from ⚙️ Themes & Settings.`,
                        { autoClose: 4000, toastId: 'msg-limit-warn' }
                    );
                }
            }
        }

        // Check character limit
        if (activeMessage.length > 2000) {
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

        let userMessage = activeMessage.trim();
        const isSchedulerRequest = /remind|schedule|timer|alarm|alert|clock|wake me up|wake up|notify|reminder|task|cancel|delete|remove|drop|revoke|stop|reschedule|postpone|prepone|change|modify|shift|move/i.test(userMessage);
        if (isSchedulerRequest) {
            setIsCurrentRequestScheduler(true);
            if (/reschedule|postpone|prepone|change|modify|shift|move/i.test(userMessage)) {
                setCurrentSchedulerType('reschedule');
            } else if (/cancel|delete|remove|drop|revoke|stop/i.test(userMessage)) {
                setCurrentSchedulerType('cancel');
            } else {
                setCurrentSchedulerType('create');
            }
        }
        const currentTone = currentUser ? tone : 'neutral'; // Use default tone for public users
        if (currentTone && currentTone !== 'neutral') {
            userMessage = `[Tone: ${currentTone}] ${userMessage}`;
        }

        // Attach pending images to the message
        let displayUserMessage = userMessage;
        let messageImages = [];
        let aiPromptMessage = userMessage;
        let imageAuditsToStream = {}; // Initialize here
        let audioUrl = '';
        let videoUrl = '';
        let documentUrl = '';
        let documentName = '';
        let ocrTextToSend = '';
        let messageFaceTags = [];

        if (pendingImages.length > 0) {
            messageImages = pendingImages.filter(img => img.type === 'image').map(img => img.url).filter(Boolean);
            
            const fileTexts = pendingImages.map(img => {
                if (img.type === 'image') {
                    const audit = auditResults[`chat_${img.id}`];
                    let auditInfo = '';
                    if (audit) {
                        const { sentinelScore, classification } = audit;
                        auditInfo = ` [Sentinel Audit: Quality Score ${sentinelScore}, Classification: ${classification.type} (${classification.category}), Status: ${classification.status}, Reason: ${classification.reason}]`;
                    }
                    const ocrText = ocrResults[img.id];
                    let ocrInfo = '';
                    if (ocrText) {
                        let truncatedOcr = ocrText.trim();
                        const MAX_TEXT_LEN = 4000;
                        if (truncatedOcr.length > MAX_TEXT_LEN) {
                            truncatedOcr = truncatedOcr.substring(0, MAX_TEXT_LEN) + `\n... [Content truncated to first ${MAX_TEXT_LEN} characters due to context limit]`;
                        }
                        ocrInfo = `\n\nExtracted Image Text Content (OCR):\n"""\n${truncatedOcr}\n"""`;
                    }
                    let faceInfo = '';
                    if (detectedFaces[img.id]) {
                        // Collect face tags for this image
                        detectedFaces[img.id].forEach(f => {
                            if (f.name !== 'Unknown') {
                                messageFaceTags.push({
                                    name: f.name,
                                    details: f.details || '',
                                    descriptor: f.descriptor
                                });
                            }
                        });
                        const faces = detectedFaces[img.id].map(f => f.name);
                        if (faces.length > 0) {
                            const knownFacesForDetails = getKnownFaces();
                            const faceList = faces.map(n => {
                                if (n === 'Unknown') return 'Unknown (Face AI detected a face; please use your vision intelligence to identify this person if asked)';
                                const knownEntry = knownFacesForDetails.find(kf => kf.name === n);
                                if (knownEntry && knownEntry.details && knownEntry.details.trim()) {
                                    return `${n} (Details: ${knownEntry.details.trim()})`;
                                }
                                return n;
                            });
                            faceInfo = `\n\nIdentified Face(s)/Person(s) in Image:\n"""\n${faceList.join(', ')}\n"""`;
                        }
                    }
                    return `I've uploaded a image file: ${img.name}${auditInfo}. Please analyze it and help me with it. File URL: ${img.url}${ocrInfo}${faceInfo}`;
                } else {
                    const fileType = img.type; // 'audio', 'video', 'document'
                    const fileUrl = img.url;
                    const extractedText = ocrResults[img.id] || '';
                    
                    let promptWithFile = `I've uploaded a ${fileType} file: ${img.name}. Please analyze it and help me with it. File URL: ${fileUrl}`;
                    if (extractedText && extractedText.trim()) {
                        const contentLabel = fileType === 'audio' ? 'Audio Transcript' : 
                                            fileType === 'video' ? 'Video Speech Transcript' : 
                                            'Extracted Document Content';
                        let truncatedExtracted = extractedText.trim();
                        const MAX_TEXT_LEN = 4000;
                        if (truncatedExtracted.length > MAX_TEXT_LEN) {
                            truncatedExtracted = truncatedExtracted.substring(0, MAX_TEXT_LEN) + `\n... [Content truncated to first ${MAX_TEXT_LEN} characters due to context limit]`;
                        }
                        promptWithFile += `\n\n${contentLabel}:\n"""\n${truncatedExtracted}\n"""`;
                    }
                    return promptWithFile;
                }
            }).join('\n\n');

            // Map audits to specific URLs for the AI tool
            const urlAudits = {};
            pendingImages.forEach(img => {
                if (img.type === 'image') {
                    const audit = auditResults[`chat_${img.id}`];
                    if (img.url && audit) {
                        urlAudits[img.url] = audit;
                    }
                }
            });
            imageAuditsToStream = urlAudits; // Store for request body

            // Also extract the first audioUrl, videoUrl, documentUrl, and documentName for mediaPayload
            const firstAudio = pendingImages.find(img => img.type === 'audio');
            const firstVideo = pendingImages.find(img => img.type === 'video');
            const firstDoc = pendingImages.find(img => img.type === 'document');

            if (firstAudio) audioUrl = firstAudio.url;
            if (firstVideo) videoUrl = firstVideo.url;
            if (firstDoc) {
                documentUrl = firstDoc.url;
                documentName = firstDoc.name;
            }

            // If there's no text, use a fallback for display, but prompt AI with specific context
            if (!displayUserMessage) {
                const fileTypesList = pendingImages.map(img => `${img.type}: ${img.name}`).join(', ');
                displayUserMessage = `Attached: ${fileTypesList}`;
            }

            aiPromptMessage = aiPromptMessage ? `${aiPromptMessage}\n\n${fileTexts}` : fileTexts;
            ocrTextToSend = fileTexts;

            // Clean up detectedFaces for sent images
            setDetectedFaces(prev => {
                const updated = { ...prev };
                pendingImages.forEach(img => {
                    delete updated[img.id];
                });
                return updated;
            });

            setPendingImages([]); // Clear pending images after they are attached
        }

        // Apply pre-prompt preference directives
        if (prePromptPreference === 'think') {
            setIsCurrentRequestDeepThinking(true);
            aiPromptMessage = aiPromptMessage ? `${aiPromptMessage}\n\n[System Directive: Think longer and provide deep step-by-step reasoning]` : "[System Directive: Think longer and provide deep step-by-step reasoning]";
        } else if (prePromptPreference === 'search') {
            setIsCurrentRequestWebSearch(true);
            aiPromptMessage = aiPromptMessage ? `${aiPromptMessage}\n\n[System Directive: Search the web for latest listings, guides, and real estate information]` : "[System Directive: Search the web for latest listings, guides, and real estate information]";
        }
        setPrePromptPreference(null);

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
            return [...currentMessages, {
                role: 'user',
                content: displayUserMessage,
                timestamp: new Date().toISOString(),
                images: messageImages,
                imageAudits: imageAuditsToStream,
                audioUrl,
                videoUrl,
                documentUrl,
                documentName,
                ocrText: ocrTextToSend || undefined,
                faceTags: messageFaceTags.length > 0 ? messageFaceTags : undefined
            }];
        });
        // Increment total message count for accurate limit enforcement
        setTotalMessageCount(prev => prev + 1);
        // Add to history stack for Ctrl+Z retrieval
        messageHistoryRef.current.push(displayUserMessage || '(Images)');
        historyIndexRef.current = -1;
        lastUserMessageRef.current = userMessage;

        let requestMediaType = null;
        if (messageImages.length > 0) {
            requestMediaType = 'image';
        } else if (audioUrl) {
            requestMediaType = 'audio';
        } else if (videoUrl) {
            requestMediaType = 'video';
        } else if (documentUrl) {
            requestMediaType = 'document';
            const extension = documentName ? documentName.split('.').pop().toLowerCase() : '';
            if (['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'md', 'xml', 'csv', 'sql'].includes(extension)) {
                requestMediaType = 'code';
            }
        }
        setCurrentRequestMediaType(requestMediaType);
        // Set loading state to show cancel button
        setIsLoading(true);
        setHasChatError(false);

        // Play sound when message is sent
        playSound('message-sent.mp3');

        // Track message sent event
        trackEvent('message_sent', {
            messageLength: userMessage.length,
            sessionId: getOrCreateSessionId(),
            imageCount: messageImages.length,
            tone: currentUser ? tone : 'neutral'
        });
        try {
            const currentSessionId = getOrCreateSessionId();
            console.log('Sending message to AI:', aiPromptMessage, 'Session:', currentSessionId);

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
                        message: aiPromptMessage,
                        displayMessage: displayUserMessage, // Custom field for non-link storage
                        images: messageImages, // Explicitly pass images
                        imageAudits: imageAuditsToStream, // Pass pre-calculated audits to backend
                        audioUrl,
                        videoUrl,
                        documentUrl,
                        documentName,
                        ocrText: ocrTextToSend || undefined,
                        isOnlyAttachment: !userMessage.trim(),
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
                        selectedProperties: selectedProperties,
                        clientTime: new Date().toString()
                    }),
                    signal: abortControllerRef.current.signal
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    if (response.status === 403 && errorData.isBlocked) {
                        setPolicyViolations(errorData.policyViolations || VIOLATION_LIMIT);
                        if (errorData.cooldownEnd) {
                            const endMs = new Date(errorData.cooldownEnd).getTime();
                            setCooldownEnd(endMs);
                            localStorage.setItem(getUserKey('cooldown_end'), endMs.toString());
                        }
                        setIsBlockedByPolicy(true);
                        setShowViolationModal(true);
                        throw new Error('Access Restricted: Safety Policy Cooldown Active');
                    }
                    if (response.status === 403 && errorData.message?.includes('restricted content')) {
                        handlePolicyViolation();
                        const vError = new Error('Safety Policy Violation Detected');
                        vError.violationsCount = errorData.policyViolations || (policyViolations + 1);
                        vError.isNowBlocked = (vError.violationsCount >= VIOLATION_LIMIT);
                        throw vError;
                    }
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                // Check if the response is JSON instead of stream (e.g. backend fallback or API status)
                const contentType = response.headers.get('Content-Type') || '';
                if (contentType.includes('application/json')) {
                    const jsonData = await response.json();
                    if (jsonData && jsonData.response) {
                        setMessages(prev => {
                            const currentMessages = Array.isArray(prev) ? prev : [];
                            return [...currentMessages, {
                                role: 'assistant',
                                content: jsonData.response.trim(),
                                timestamp: new Date().toISOString()
                            }];
                        });
                        setTotalMessageCount(prev => prev + 1);
                        setIsLoading(false);
                        playSound('message-received.mp3');
                        if (jsonData.sessionId && jsonData.sessionId !== sessionId) {
                            setSessionId(jsonData.sessionId);
                            localStorage.setItem('gemini_session_id', jsonData.sessionId);
                        }
                        fetchRateLimitStatus();
                        
                        // Show sent success check briefly
                        setSendIconSent(true);
                        setTimeout(() => setSendIconSent(false), 600);
                        return; // Exit handleSubmit early as we got a full JSON response
                    }
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
                // Increment total message count for the assistant response
                setTotalMessageCount(prev => prev + 1);

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
                                    } else if (streamData.type === 'tool_call') {
                                        if (['schedule_reminder', 'get_user_reminders', 'reschedule_reminder', 'cancel_reminder'].includes(streamData.name)) {
                                            setIsCurrentRequestScheduler(true);
                                            if (streamData.name === 'reschedule_reminder') {
                                                setCurrentSchedulerType('reschedule');
                                            } else if (streamData.name === 'cancel_reminder') {
                                                setCurrentSchedulerType('cancel');
                                            } else {
                                                setCurrentSchedulerType('create');
                                            }
                                        }
                                    } else if (streamData.type === 'done') {
                                        isStreamingComplete = true;
                                        streamingResponse = streamData.content;
                                        const recommendations = streamData.recommendations;
                                        const tokenUsage = streamData.tokenUsage;

                                        // Finalize the streaming message
                                        setMessages(prev => {
                                            const currentMessages = Array.isArray(prev) ? prev : [];
                                            const updatedMessages = [...currentMessages];
                                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                                            if (lastMessage && lastMessage.isStreaming) {
                                                lastMessage.content = streamingResponse;
                                                lastMessage.recommendations = recommendations;
                                                if (tokenUsage) lastMessage.tokenUsage = tokenUsage;
                                                delete lastMessage.isStreaming;
                                            }
                                            return updatedMessages;
                                        });

                                        // Clear loading state for streaming
                                        setIsLoading(false);

                                        // Update local metrics and session total
                                        if (tokenUsage && tokenUsage.totalTokens) {
                                            const added = tokenUsage.totalTokens;
                                            setActiveSessionTokens(prev => prev + added);
                                            setLifetimeUsage(prev => ({
                                                ...prev,
                                                totalTokens: (prev.totalTokens || 0) + added
                                            }));

                                            // Trigger coin burst animation for realistic token usage feedback
                                            setBurstCount(Math.min(35, Math.max(12, Math.floor(added / 4))));
                                            setShowCoinBurst(true);
                                        }
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
                                const tokenUsage = streamData.tokenUsage;
                                // Finalize message...
                                setMessages(prev => {
                                    const currentMessages = Array.isArray(prev) ? prev : [];
                                    const updatedMessages = [...currentMessages];
                                    const lastMessage = updatedMessages[updatedMessages.length - 1];
                                    if (lastMessage && lastMessage.isStreaming) {
                                        lastMessage.content = streamingResponse;
                                        lastMessage.recommendations = recommendations;
                                        if (tokenUsage) lastMessage.tokenUsage = tokenUsage;
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
                        message: aiPromptMessage,
                        displayMessage: displayUserMessage,
                        images: messageImages,
                        imageAudits: imageAuditsToStream, // Pass pre-calculated audits to backend
                        audioUrl,
                        videoUrl,
                        documentUrl,
                        documentName,
                        ocrText: ocrTextToSend || undefined,
                        isOnlyAttachment: !userMessage.trim(),
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
                        selectedProperties: selectedProperties,
                        clientTime: new Date().toString()
                    }),
                    signal: abortControllerRef.current.signal
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    if (response.status === 403 && errorData.isBlocked) {
                        setPolicyViolations(errorData.policyViolations || VIOLATION_LIMIT);
                        if (errorData.cooldownEnd) {
                            const endMs = new Date(errorData.cooldownEnd).getTime();
                            setCooldownEnd(endMs);
                            localStorage.setItem(getUserKey('cooldown_end'), endMs.toString());
                        }
                        setIsBlockedByPolicy(true);
                        setShowViolationModal(true);
                        throw new Error('Access Restricted: Safety Policy Cooldown Active');
                    }
                    if (response.status === 403 && errorData.message?.includes('restricted content')) {
                        handlePolicyViolation();
                        const vError = new Error('Safety Policy Violation Detected');
                        vError.violationsCount = errorData.policyViolations || (policyViolations + 1);
                        vError.isNowBlocked = (vError.violationsCount >= VIOLATION_LIMIT);
                        throw vError;
                    }
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
                            recommendations: data.recommendations,
                            tokenUsage: data.tokenUsage || undefined
                        }];
                    });
                    // Increment total message count for the assistant response
                    setTotalMessageCount(prev => prev + 1);

                    // Update local metrics and session total
                    if (data.tokenUsage && (data.tokenUsage.totalTokens || data.tokenUsage.total_tokens)) {
                        const added = data.tokenUsage.totalTokens || data.tokenUsage.total_tokens;
                        setActiveSessionTokens(prev => prev + added);
                        setLifetimeUsage(prev => ({
                            ...prev,
                            totalTokens: (prev.totalTokens || 0) + added
                        }));

                        // Trigger coin burst animation for realistic token usage feedback
                        setBurstCount(Math.min(35, Math.max(12, Math.floor(added / 4))));
                        setShowCoinBurst(true);
                    }
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
            // The 403 handling was moved to the `if (!response.ok)` block above,
            // as `response` is not directly available in the catch block.
            // If the error message includes 'restricted content' from a thrown error,
            // it will be caught by the next `if` block.

            if (error.message.includes('restricted content') || error.message.includes('Safety Policy Violation Detected')) {
                // Handle AI Moderated Restriction or explicit policy violation
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
                    const currentViolations = error.violationsCount || (policyViolations + 1);
                    const remaining = Math.max(0, VIOLATION_LIMIT - currentViolations);

                    let violationFooter = "";
                    if (currentViolations >= VIOLATION_LIMIT) {
                        violationFooter = `\n\n**Maximum violations reached (${currentViolations}/${VIOLATION_LIMIT}).** Your access to the AI assistant has been restricted for 24 hours.`;
                    } else {
                        violationFooter = `\n\n**Warning: This is violation ${currentViolations}/${VIOLATION_LIMIT}.** You have ${remaining} more ${remaining === 1 ? 'chance' : 'chances'} before a 24-hour restriction is applied.`;
                    }

                    const violationContent = `⚠️ **Safety Policy Violation Detected**\n\nI cannot fulfill this request because it falls under a restricted category (e.g., Harassment, Hate Speech, Violence, or Illegal Activities).${violationFooter}\n\nThis incident has been flagged for review.`;

                    // Check if there is an active streaming message at the end of the conversation
                    const lastMessage = updatedMessages[updatedMessages.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
                        lastMessage.content = violationContent;
                        delete lastMessage.isStreaming;
                        lastMessage.isError = true;
                        lastMessage.isViolation = true;
                    } else {
                        updatedMessages.push({
                            role: 'assistant',
                            content: violationContent,
                            timestamp: new Date().toISOString(),
                            isError: true,
                            isViolation: true
                        });
                    }

                    return updatedMessages;
                });
                setHasChatError(true);

                // Trigger violation sequence
                handlePolicyViolation();
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
                    const updatedMessages = [...currentMessages];
                    const lastMessage = updatedMessages[updatedMessages.length - 1];
                    const errContent = `I'm having a bit of trouble connecting right now (${errorMessage}). \n\nFeel free to try again in a moment or rephrase your request!`;
                    
                    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
                        lastMessage.content = errContent;
                        delete lastMessage.isStreaming;
                        lastMessage.isError = false;
                        lastMessage.originalUserMessage = lastUserMessageRef.current;
                    } else {
                        updatedMessages.push({
                            role: 'assistant',
                            content: errContent,
                            timestamp: new Date().toISOString(),
                            isError: false, // Set to false to show as a normal bubble per user request
                            originalUserMessage: lastUserMessageRef.current
                        });
                    }
                    return updatedMessages;
                });
                if (!isOpen) {
                    setUnreadCount(count => count + 1);
                }
                setHasChatError(true);
            }
        } finally {
            setIsLoading(false);
            setIsCurrentRequestScheduler(false);
            setCurrentSchedulerType('create');
            setCurrentRequestMediaType(null);
            setIsCurrentRequestDeepThinking(false);
            setIsCurrentRequestWebSearch(false);

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

    const retryMessage = async (originalMessage, messageIndex, options = {}) => {
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

        if (options.thinkLonger) {
            setIsCurrentRequestDeepThinking(true);
        }
        if (options.searchWeb) {
            setIsCurrentRequestWebSearch(true);
        }

        const isSchedulerRequest = /remind|schedule|timer|alarm|alert|clock|wake me up|wake up|notify|reminder|task|cancel|delete|remove|drop|revoke|stop|reschedule|postpone|prepone|change|modify|shift|move/i.test(originalMessage);
        if (isSchedulerRequest) {
            setIsCurrentRequestScheduler(true);
            if (/reschedule|postpone|prepone|change|modify|shift|move/i.test(originalMessage)) {
                setCurrentSchedulerType('reschedule');
            } else if (/cancel|delete|remove|drop|revoke|stop/i.test(originalMessage)) {
                setCurrentSchedulerType('cancel');
            } else {
                setCurrentSchedulerType('create');
            }
        }

        // Branching implementation:
        // 1. Capture original assistant message and tail
        const originalAssistantMessage = messages[messageIndex];
        const currentTail = messages.slice(messageIndex + 1);

        let variants = [];
        let activeIdx = 0;

        if (originalAssistantMessage) {
            activeIdx = originalAssistantMessage.activeVersionIndex || 0;
            if (originalAssistantMessage.variants && originalAssistantMessage.variants.length > 0) {
                variants = [...originalAssistantMessage.variants];
                variants[activeIdx] = {
                    ...variants[activeIdx],
                    content: originalAssistantMessage.content,
                    images: originalAssistantMessage.images,
                    imageUrl: originalAssistantMessage.imageUrl,
                    audioUrl: originalAssistantMessage.audioUrl,
                    videoUrl: originalAssistantMessage.videoUrl,
                    documentUrl: originalAssistantMessage.documentUrl,
                    documentName: originalAssistantMessage.documentName,
                    isError: originalAssistantMessage.isError,
                    recommendations: originalAssistantMessage.recommendations,
                    tokenUsage: originalAssistantMessage.tokenUsage,
                    tail: currentTail
                };
            } else {
                variants = [
                    {
                        content: originalAssistantMessage.content,
                        images: originalAssistantMessage.images,
                        imageUrl: originalAssistantMessage.imageUrl,
                        audioUrl: originalAssistantMessage.audioUrl,
                        videoUrl: originalAssistantMessage.videoUrl,
                        documentUrl: originalAssistantMessage.documentUrl,
                        documentName: originalAssistantMessage.documentName,
                        isError: originalAssistantMessage.isError,
                        recommendations: originalAssistantMessage.recommendations,
                        tokenUsage: originalAssistantMessage.tokenUsage,
                        tail: currentTail,
                        timestamp: originalAssistantMessage.timestamp,
                        role: 'assistant'
                    }
                ];
            }
        }

        const newVersionIndex = variants.length;

        // Truncate messages list to exclude the assistant message and its tail during the API call
        const nextMessages = messages.slice(0, messageIndex);
        setMessages(nextMessages);

        try {
            const currentSessionId = getOrCreateSessionId();

            // Support cancelling with AbortController
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();

            let messagePayload = originalMessage;
            if (options.thinkLonger) {
                messagePayload += "\n\n[System Directive: Think longer and provide deep step-by-step reasoning]";
            } else if (options.searchWeb) {
                messagePayload += "\n\n[System Directive: Search the web for latest listings, guides, and real estate information]";
            }

            // Sync the truncated tree first to make sure database is consistent with the new active path
            await syncChatTreeToBackend(nextMessages);

            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: messagePayload,
                    history: enableContextMemory ? nextMessages.slice(-parseInt(contextWindow)) : nextMessages.slice(-10),
                    sessionId: currentSessionId,
                    tone: currentUser ? tone : 'neutral',
                    responseLength: aiResponseLength,
                    creativity: aiCreativity,
                    temperature: temperature,
                    topP: topP,
                    topK: topK,
                    maxTokens: maxTokens,
                    enableStreaming: false, // Force non-streaming for retries to ensure JSON response
                    enableContextMemory: enableContextMemory,
                    contextWindow: contextWindow,
                    enableSystemPrompts: enableSystemPrompts,
                    clientTime: new Date().toString(),
                    changeInstruction: options.changeInstruction
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 403 && errorData.isBlocked) {
                    setPolicyViolations(errorData.policyViolations || VIOLATION_LIMIT);
                    if (errorData.cooldownEnd) {
                        const endMs = new Date(errorData.cooldownEnd).getTime();
                        setCooldownEnd(endMs);
                        localStorage.setItem(getUserKey('cooldown_end'), endMs.toString());
                    }
                    setIsBlockedByPolicy(true);
                    setShowViolationModal(true);
                    throw new Error('Access Restricted: Safety Policy Cooldown Active');
                }
                if (response.status === 403 && errorData.message?.includes('restricted content')) {
                    handlePolicyViolation();
                    const vError = new Error('Safety Policy Violation Detected');
                    vError.violationsCount = errorData.policyViolations || (policyViolations + 1);
                    vError.isNowBlocked = (vError.violationsCount >= VIOLATION_LIMIT);
                    throw vError;
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.response && typeof data.response === 'string') {
                const trimmedResponse = data.response.trim();

                // Create the new variant for the assistant message
                const newVersion = {
                    content: trimmedResponse,
                    role: 'assistant',
                    timestamp: new Date().toISOString(),
                    recommendations: data.recommendations,
                    tokenUsage: data.tokenUsage || undefined,
                    tail: []
                };

                const newAssistantMessage = {
                    role: 'assistant',
                    content: trimmedResponse,
                    timestamp: newVersion.timestamp,
                    variants: [...variants, newVersion],
                    activeVersionIndex: newVersionIndex,
                    recommendations: data.recommendations,
                    tokenUsage: data.tokenUsage || undefined
                };

                const finalMessages = [...nextMessages, newAssistantMessage];
                setMessages(finalMessages);
                await syncChatTreeToBackend(finalMessages);

                setTotalMessageCount(prev => prev + 1);

                if (data.tokenUsage && (data.tokenUsage.totalTokens || data.tokenUsage.total_tokens)) {
                    const added = data.tokenUsage.totalTokens || data.tokenUsage.total_tokens;
                    setActiveSessionTokens(prev => prev + added);
                    setLifetimeUsage(prev => ({
                        ...prev,
                        totalTokens: (prev.totalTokens || 0) + added
                    }));
                    setBurstCount(Math.min(35, Math.max(12, Math.floor(added / 4))));
                    setShowCoinBurst(true);
                }

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
                setIsLoading(false);
                fetchRateLimitStatus();
                return;
            }

            if (error.message.includes('timeout')) {
                errorMessage = 'Request timed out. The response is taking longer than expected. Please try again.';
            } else if (error.message.includes('HTTP error')) {
                errorMessage = 'Server error. Please try again later.';
            } else if (error.message.includes('Invalid response structure')) {
                errorMessage = 'I received an invalid response. Please try again.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }

            fetchRateLimitStatus();

            // Create error variant
            const errorVersion = {
                content: errorMessage,
                role: 'assistant',
                isError: true,
                timestamp: new Date().toISOString(),
                tail: []
            };

            const errorAssistantMessage = {
                role: 'assistant',
                content: errorMessage,
                isError: true,
                timestamp: errorVersion.timestamp,
                variants: [...variants, errorVersion],
                activeVersionIndex: newVersionIndex
            };

            const finalMessages = [...nextMessages, errorAssistantMessage];
            setMessages(finalMessages);
            await syncChatTreeToBackend(finalMessages);
        } finally {
            setIsLoading(false);
            setIsCurrentRequestScheduler(false);
            setCurrentSchedulerType('create');
            setIsCurrentRequestDeepThinking(false);
            setIsCurrentRequestWebSearch(false);
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

    const shareMessage = async (message, index) => {
        let sharePath = '/ai';
        if (currentUser) {
            sharePath = (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/admin/ai' : '/user/ai';
        }

        let promptText = 'Hello';
        if (index !== undefined && index > 0) {
            // Find the nearest preceding user message
            for (let i = index - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    promptText = messages[i].content;
                    break;
                }
            }
        } else {
            // Fallback: search the entire array backwards from the end
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    promptText = messages[i].content;
                    break;
                }
            }
        }

        const shareUrl = `${window.location.origin}${sharePath}?prompt=${encodeURIComponent(promptText)}`;

        setSocialShareConfig({
            url: shareUrl,
            title: 'SetuAI Response 🤖',
            description: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : '')
        });
        setShowSocialShare(true);
    };

    // Edit message functions
    const startEditingMessage = (messageIndex, messageContent, images = []) => {
        setEditingMessageIndex(messageIndex);
        setEditingMessageContent(messageContent);
        setEditingMessageImages(images || []);
    };

    const syncChatTreeToBackend = async (currentMessages) => {
        if (!currentUser || !getOrCreateSessionId()) return;
        try {
            // Filter out the dynamically-added welcome message before syncing.
            // The welcome message is prepended client-side by loadChatHistory() and is NOT
            // stored in the DB. Sending it would break the server-side merge heuristic.
            const welcomePrefix = "Hello! I'm SetuAI your AI assistant powered by Groq and co-powered by Sentinel v2.0 Neural Engine (TensorFlow). How can I help you with your real estate needs today?";
            const messagesToSync = currentMessages.filter(m =>
                !(m.role === 'assistant' && m.content && m.content.startsWith(welcomePrefix))
            );

            console.log('Syncing chat tree to backend...', messagesToSync.length, 'messages (filtered from', currentMessages.length, ')');
            await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${getOrCreateSessionId()}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesToSync,
                    lastActivity: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('Failed to sync chat tree to backend:', error);
        }
    };

    const switchMessageVersion = async (index, newVersionIndex) => {
        if (newVersionIndex < 0) return;

        // Use a functional update to get the latest messages
        let finalUpdatedList = null;

        setMessages(prev => {
            const next = [...prev];
            const message = { ...next[index] };

            if (!message.variants || newVersionIndex >= message.variants.length) return prev;

            // 1. Save current state of this version before switching (CRITICAL to avoid losing current tail/content)
            const currentActiveIndex = message.activeVersionIndex || 0;
            const updatedVariants = [...message.variants];

            // Ensure we capture the current visible content and everything after it
            updatedVariants[currentActiveIndex] = {
                ...updatedVariants[currentActiveIndex],
                content: message.content,
                images: message.images,
                imageUrl: message.imageUrl,
                audioUrl: message.audioUrl,
                videoUrl: message.videoUrl,
                documentUrl: message.documentUrl,
                documentName: message.documentName,
                tail: next.slice(index + 1)
            };

            // 2. Switch to target version
            const targetVersion = updatedVariants[newVersionIndex];

            // Reconstruct the message object for the new version
            const updatedMessage = {
                ...message,
                content: targetVersion.content || '',
                images: targetVersion.images,
                imageUrl: targetVersion.imageUrl,
                audioUrl: targetVersion.audioUrl,
                videoUrl: targetVersion.videoUrl,
                documentUrl: targetVersion.documentUrl,
                documentName: targetVersion.documentName,
                activeVersionIndex: newVersionIndex,
                variants: updatedVariants,
                timestamp: targetVersion.timestamp || message.timestamp
            };

            // 3. Reconstruct full messages array
            finalUpdatedList = [...next.slice(0, index), updatedMessage, ...(targetVersion.tail || [])];
            return finalUpdatedList;
        });

        // Sync with backend after we have the final list
        // Note: Since setMessages is async, we use the locally computed finalUpdatedList
        if (finalUpdatedList) {
            await syncChatTreeToBackend(finalUpdatedList);
        }
    };

    const cancelEditingMessage = () => {
        setEditingMessageIndex(null);
        setEditingMessageContent('');
        setEditingMessageImages([]);
    };

    const submitEditedMessage = async (messageIndex) => {
        if (!editingMessageContent.trim()) {
            toast.error('Message cannot be empty');
            return;
        }

        // Check message limit for edited messages (skip if unlimited)
        if (messageLimit !== 'unlimited') {
            const messageLimitNum = parseInt(messageLimit);
            if (!isNaN(messageLimitNum) && messageLimitNum > 0) {
                const actualMessageCount = Math.max(totalMessageCount, messages.length);
                if (actualMessageCount >= messageLimitNum) {
                    toast.error(
                        `🚫 Message limit reached (${actualMessageCount}/${messageLimitNum} messages). You can increase your message limit from the ⚙️ Themes & Settings panel, or start a new chat session.`,
                        { autoClose: 6000 }
                    );
                    return;
                }
            }
        }

        try {
            const updatedMessages = [...messages];
            const originalMessage = { ...updatedMessages[messageIndex] };

            // Update content and images
            const editedMessage = {
                ...originalMessage,
                content: editingMessageContent,
                images: editingMessageImages,
                timestamp: new Date().toISOString()
            };

            // 1. Capture the "tail" of current conversation at this point
            const currentTail = updatedMessages.slice(messageIndex + 1);

            // 2. Initialize or update variants (ChatGPT style)
            // Save the state of the branch we're leaving before we branch off
            let variants = [];
            let activeIdx = originalMessage.activeVersionIndex || 0;

            if (originalMessage.variants && originalMessage.variants.length > 0) {
                // Keep existing variants and update the current active one before adding the new one
                variants = [...originalMessage.variants];
                variants[activeIdx] = {
                    ...variants[activeIdx],
                    content: originalMessage.content, // Save current before swapping
                    images: originalMessage.images,
                    imageUrl: originalMessage.imageUrl,
                    audioUrl: originalMessage.audioUrl,
                    videoUrl: originalMessage.videoUrl,
                    documentUrl: originalMessage.documentUrl,
                    documentName: originalMessage.documentName,
                    ocrText: originalMessage.ocrText,
                    visionAnalysis: originalMessage.visionAnalysis,
                    tail: currentTail
                };
            } else {
                // Initialize first variant if none exist
                variants = [
                    {
                        content: originalMessage.content,
                        images: originalMessage.images,
                        imageUrl: originalMessage.imageUrl,
                        audioUrl: originalMessage.audioUrl,
                        videoUrl: originalMessage.videoUrl,
                        documentUrl: originalMessage.documentUrl,
                        documentName: originalMessage.documentName,
                        ocrText: originalMessage.ocrText,
                        visionAnalysis: originalMessage.visionAnalysis,
                        tail: currentTail,
                        timestamp: originalMessage.timestamp,
                        role: originalMessage.role
                    }
                ];
            }

            // 3. Create the new version
            const newVersionIndex = variants.length;
            const newImages = editingMessageImages || [];
            const newImageUrl = newImages.length === 1 ? newImages[0] : null;

            // Filter OCR text to only include remaining images
            let updatedOcrText = '';
            if (originalMessage.ocrText) {
                const ocrBlocks = originalMessage.ocrText.split(/I've uploaded a image file:/);
                const keptBlocks = [];
                for (const block of ocrBlocks) {
                    if (!block.includes('File URL:')) {
                        if (block.trim()) keptBlocks.push(block);
                    } else {
                        const hasMatchingImg = newImages.some(imgUrl => block.includes(imgUrl));
                        if (hasMatchingImg) {
                            keptBlocks.push(block);
                        }
                    }
                }
                updatedOcrText = keptBlocks.join("I've uploaded a image file:");
            }

            const newVersion = {
                content: editingMessageContent.trim(),
                images: newImages,
                imageUrl: newImageUrl,
                audioUrl: originalMessage.audioUrl,
                videoUrl: originalMessage.videoUrl,
                documentUrl: originalMessage.documentUrl,
                documentName: originalMessage.documentName,
                ocrText: updatedOcrText,
                visionAnalysis: originalMessage.visionAnalysis,
                tail: [], // New branch starts empty
                timestamp: new Date().toISOString(),
                role: 'user'
            };

            const newMessage = {
                ...originalMessage,
                content: editingMessageContent.trim(),
                images: newImages,
                imageUrl: newImageUrl,
                ocrText: updatedOcrText,
                timestamp: newVersion.timestamp,
                variants: [...variants, newVersion],
                activeVersionIndex: newVersionIndex
            };

            // 4. Update UI state immediately with truncated history
            const nextMessages = [...updatedMessages.slice(0, messageIndex), newMessage];
            setMessages(nextMessages);

            // Clear editing state
            setEditingMessageIndex(null);
            setEditingMessageContent('');

            // 5. Sync initial branch state to backend before sending new prompt
            await syncChatTreeToBackend(nextMessages);

            // 6. Send to API - passing the history only UP TO the edit point, plus any media
            await sendEditedMessageToAPI(editingMessageContent.trim(), nextMessages.slice(0, messageIndex), {
                images: newImages,
                imageUrl: newImageUrl,
                audioUrl: originalMessage.audioUrl,
                videoUrl: originalMessage.videoUrl,
                documentUrl: originalMessage.documentUrl,
                documentName: originalMessage.documentName,
                ocrText: updatedOcrText
            });



            // Log for debugging
            console.log('Successfully branched message at index', messageIndex, 'New version count:', variants.length + 1);
        } catch (error) {
            console.error('Error submitting edited message:', error);
            toast.error('Failed to send edited message');
        }
    };

    // Send edited message directly to API
    const sendEditedMessageToAPI = async (messageContent, historyOverride = null, media = {}) => {
        if (!messageContent.trim() || isLoading) return;

        // Check rate limit
        if (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin') {
            toast.error('Rate limit exceeded. Please wait before sending more messages.');
            return;
        }

        setIsLoading(true);

        const isSchedulerRequest = /remind|schedule|timer|alarm|alert|clock|wake me up|wake up|notify|reminder|task|cancel|delete|remove|drop|revoke|stop|reschedule|postpone|prepone|change|modify|shift|move/i.test(messageContent);
        if (isSchedulerRequest) {
            setIsCurrentRequestScheduler(true);
            if (/reschedule|postpone|prepone|change|modify|shift|move/i.test(messageContent)) {
                setCurrentSchedulerType('reschedule');
            } else if (/cancel|delete|remove|drop|revoke|stop/i.test(messageContent)) {
                setCurrentSchedulerType('cancel');
            } else {
                setCurrentSchedulerType('create');
            }
        }

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
                    ...media,
                    history: (historyOverride || messages).slice(-10), // Use history override if provided
                    sessionId: currentSessionId,
                    tone: currentUser ? tone : 'neutral', // Send current tone setting or default for public users
                    responseLength: aiResponseLength, // Send response length setting
                    creativity: aiCreativity, // Send creativity level setting
                    enableStreaming: false, // Force non-streaming to ensure JSON response when editing
                    clientTime: new Date().toString()
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
                // Increment total message count for the edited message assistant response
                setTotalMessageCount(prev => prev + 1);

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
            setIsCurrentRequestScheduler(false);
            setCurrentSchedulerType('create');
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
            const combinedSuggestions = [...propertySuggestions, ...blogSuggestions];
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedEditSuggestionIndex(prev =>
                        prev < combinedSuggestions.length - 1 ? prev + 1 : 0
                    );
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedEditSuggestionIndex(prev =>
                        prev > 0 ? prev - 1 : combinedSuggestions.length - 1
                    );
                    return;
                case 'Enter':
                    e.preventDefault();
                    if (selectedEditSuggestionIndex >= 0 && combinedSuggestions[selectedEditSuggestionIndex]) {
                        handleEditSuggestionSelect(combinedSuggestions[selectedEditSuggestionIndex]);
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

    const togglePinSession = async (sessionId, currentPinnedState) => {
        if (!currentUser || !sessionId) return;
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPinned: !currentPinnedState })
            });

            if (response.ok) {
                console.log(`Session pin state updated: ${!currentPinnedState}`);
                toast.success(currentPinnedState ? 'Chat unpinned' : 'Chat pinned');
                await loadChatSessions();
            } else {
                console.error('Failed to toggle session pin:', response.status);
                toast.error('Failed to update pin state');
            }
        } catch (error) {
            console.error('Error toggling session pin:', error);
            toast.error('Failed to update pin state');
        }
    };

    const loadChatSessions = async () => {
        if (!currentUser) return [];

        setIsLoadingSessions(true);
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/gemini/sessions`);

            if (response.ok) {
                const data = await response.json();
                const sessions = data.sessions || [];
                setChatSessions(sessions);
                setLifetimeUsage(data.lifetimeUsage || { totalTokens: 0 });

                // Sync currentChatName with the active session
                const activeSessionId = getOrCreateSessionId();
                const activeSession = sessions.find(s => s.sessionId === activeSessionId);
                if (activeSession) {
                    setActiveSessionTokens(activeSession.totalTokens || 0);
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
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const loadSessionHistory = async (sessionId, closeModalOnSuccess = false) => {
        setIsLoadingSessionHistory(true);
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${sessionId}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.messages && Array.isArray(data.data.messages)) {
                    let sessionMessages = data.data.messages;

                    setMessages(sessionMessages);
                    // Update total message count from backend response
                    if (data.data.totalMessages !== undefined) {
                        setTotalMessageCount(data.data.totalMessages);
                    } else {
                        setTotalMessageCount(sessionMessages.length);
                    }
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

                    // Apply per-chat settings from the session data
                    if (data.data.settings) {
                        applySessionSettings(data.data.settings);
                    }

                    // Close history modal AFTER successful load
                    if (closeModalOnSuccess) {
                        setShowHistory(false);
                        setOpenHistoryMenuSessionId(null);
                    }

                    toast.success('Chat loaded successfully');
                }
            }
        } catch (error) {
            console.error('Error loading chat:', error);
            toast.error('Failed to load chat');
        } finally {
            setIsLoadingSessionHistory(false);
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
                        messageIndex: bookmark.messageIndex,
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
 
         setIsLoadingNewSession(true);
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
 
                     // Reset messages to empty array for dynamic empty state
                     setMessages([]);
                     setFloatingDateLabel('');
                     setIsScrolling(false);
                     setTotalMessageCount(0); // Reset total message count for new session
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
         } finally {
             setIsLoadingNewSession(false);
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

    function toggleVoiceInput() {
        if (isBlockedByPolicy) {
            toast.warning('Voice input is disabled during your policy cooldown.');
            return;
        }
        if (!currentUser) {
            toast.info('Please login to use voice input');
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }

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
        const validAudioTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/x-aac', 'audio/ogg', 'audio/webm'];
        const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/mkv', 'video/quicktime', 'video/x-matroska'];
        const validDocTypes = ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'];

        const allValidTypes = [...validImageTypes, ...validAudioTypes, ...validVideoTypes, ...validDocTypes];

        const validFiles = [];
        const rejectedFiles = [];

        files.forEach(file => {
            const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
            const isImage = validImageTypes.includes(file.type) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
            const isAudio = validAudioTypes.includes(file.type) || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'].includes(ext);
            const isVideo = validVideoTypes.includes(file.type) || ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
            const isDoc = validDocTypes.includes(file.type) || ['pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'pptx', 'ppt'].includes(ext);

            if (file.size > maxSize) {
                rejectedFiles.push(`${file.name} (too large - max 10MB)`);
            } else if (!(isImage || isAudio || isVideo || isDoc)) {
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

            // Verify total file slots limit (max 5)
            const currentFilesCount = pendingImages.length;
            if (currentFilesCount + files.length > 5) {
                toast.error(`You can only upload up to 5 files. ${5 - currentFilesCount} slots remaining.`);
                // Take only what fits
                files.splice(5 - currentFilesCount);
            }

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                let fileType = 'document';
                if (file.type.startsWith('image/')) {
                    fileType = 'image';
                } else if (file.type.startsWith('audio/')) {
                    fileType = 'audio';
                } else if (file.type.startsWith('video/')) {
                    fileType = 'video';
                }

                const tempId = Date.now() + Math.random();
                const controller = new AbortController();

                // Add to pending with uploading state
                setPendingImages(prev => [...prev, {
                    id: tempId,
                    name: file.name,
                    type: fileType,
                    uploading: true,
                    progress: 0,
                    controller: controller
                }]);

                if (fileType === 'image') {
                    const localUrl = URL.createObjectURL(file);
                    runFacialRecognition(localUrl, tempId);
                }

                try {
                    let uploadEndpoint = '';
                    let formData = new FormData();
                    if (fileType === 'image') {
                        uploadEndpoint = '/api/upload/image';
                        formData.append('image', file);
                    } else if (fileType === 'audio') {
                        uploadEndpoint = '/api/upload/audio';
                        formData.append('audio', file);
                    } else if (fileType === 'video') {
                        uploadEndpoint = '/api/upload/video';
                        formData.append('video', file);
                    } else {
                        uploadEndpoint = '/api/upload/document';
                        formData.append('document', file);
                    }

                    const response = await authenticatedFetch(`${API_BASE_URL}${uploadEndpoint}`, {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal
                    });

                    if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
                    const uploadData = await response.json();
                    const fileUrl = uploadData.imageUrl || uploadData.audioUrl || uploadData.videoUrl || uploadData.documentUrl;

                    // Update pending file with the real URL
                    setPendingImages(prev => prev.map(img =>
                        img.id === tempId ? { ...img, url: fileUrl, uploading: false, controller: null } : img
                    ));

                    // Trigger pixel-level audit for the AI if it is an image
                    if (fileType === 'image') {
                        performAudit(file, tempId, 'chat');
                    }

                    // Run text extraction/transcription in the background
                    if (fileType === 'image') {
                        (async () => {
                            try {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: true }));
                                const text = await extractTextFromFile(file, (progressMsg) => {
                                    console.log(`[OCR ${file.name}] ${progressMsg}`);
                                });
                                if (text && text.trim()) {
                                    setOcrResults(prev => ({ ...prev, [tempId]: text.trim() }));
                                }
                            } catch (ocrErr) {
                                console.warn(`OCR skipped/failed for image ${file.name}:`, ocrErr);
                            } finally {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: false }));
                            }
                        })();
                    } else if (fileType === 'document') {
                        (async () => {
                            try {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: true }));
                                const text = await extractTextFromFile(file, (progressMsg) => {
                                    console.log(`[Doc Extraction ${file.name}] ${progressMsg}`);
                                    toast.info(`[Document Processing] ${progressMsg}`, { autoClose: 1500, toastId: `doc-parse-${tempId}` });
                                });
                                if (text && text.trim()) {
                                    setOcrResults(prev => ({ ...prev, [tempId]: text.trim() }));
                                    toast.success(`[Document Processing] Successfully parsed ${file.name}!`, { autoClose: 2000, toastId: `doc-parse-success-${tempId}` });
                                }
                            } catch (parseErr) {
                                console.error('Failed client-side text extraction:', parseErr);
                                toast.warn(`Could not extract raw text from ${file.name} directly. Fulfilling as attachment.`, { autoClose: 3500 });
                            } finally {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: false }));
                            }
                        })();
                    } else if (fileType === 'audio') {
                        (async () => {
                            try {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: true }));
                                toast.info('🎤 Transcribing audio...', { autoClose: 2000, toastId: `audio-transcribe-${tempId}` });
                                
                                const transcribeResponse = await authenticatedFetch(`${API_BASE_URL}/api/speech-to-text/transcribe`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ audioUrl: fileUrl })
                                });
                                
                                if (transcribeResponse.ok) {
                                    const transcribeData = await transcribeResponse.json();
                                    if (transcribeData.success && transcribeData.transcription) {
                                        setOcrResults(prev => ({ ...prev, [tempId]: transcribeData.transcription.trim() }));
                                        const duration = transcribeData.duration ? ` (${Math.round(transcribeData.duration)}s)` : '';
                                        toast.success(`🎤 Audio transcribed successfully${duration}`, { autoClose: 2000, toastId: `audio-transcribe-done-${tempId}` });
                                    }
                                }
                            } catch (transcribeErr) {
                                console.error('Audio transcription failed:', transcribeErr);
                                toast.warn('Could not transcribe audio. Sending as attachment only.', { autoClose: 3000 });
                            } finally {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: false }));
                            }
                        })();
                    } else if (fileType === 'video') {
                        (async () => {
                            try {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: true }));
                                toast.info('🎬 Extracting audio from video...', { autoClose: 2000, toastId: `video-extract-${tempId}` });

                                const videoAudioBlob = await new Promise((resolve, reject) => {
                                    const video = document.createElement('video');
                                    video.src = URL.createObjectURL(file);
                                    video.muted = true;
                                    
                                    video.onloadedmetadata = () => {
                                        const maxDuration = Math.min(video.duration, 300);
                                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                        const source = audioContext.createMediaElementSource(video);
                                        const dest = audioContext.createMediaStreamDestination();
                                        source.connect(dest);
                                        
                                        const mediaRecorder = new MediaRecorder(dest.stream, {
                                            mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
                                        });
                                        const chunks = [];
                                        
                                        mediaRecorder.ondataavailable = (e) => {
                                            if (e.data.size > 0) chunks.push(e.data);
                                        };
                                        
                                        mediaRecorder.onstop = () => {
                                            audioContext.close();
                                            URL.revokeObjectURL(video.src);
                                            const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
                                            resolve(blob);
                                        };

                                        mediaRecorder.onerror = (err) => {
                                            audioContext.close();
                                            URL.revokeObjectURL(video.src);
                                            reject(err);
                                        };
                                        
                                        video.onended = () => mediaRecorder.stop();
                                        setTimeout(() => {
                                            if (mediaRecorder.state === 'recording') {
                                                mediaRecorder.stop();
                                                video.pause();
                                            }
                                        }, maxDuration * 1000 + 500);
                                        
                                        mediaRecorder.start();
                                        video.play().catch(reject);
                                    };
                                    
                                    video.onerror = reject;
                                });

                                if (videoAudioBlob && videoAudioBlob.size > 1000) {
                                    const audioFormData = new FormData();
                                    audioFormData.append('audio', videoAudioBlob, 'video-audio.webm');

                                    const audioUploadRes = await authenticatedFetch(`${API_BASE_URL}/api/upload/audio`, {
                                        method: 'POST',
                                        body: audioFormData
                                    });

                                    if (audioUploadRes.ok) {
                                        const audioUploadData = await audioUploadRes.json();
                                        const audioFileUrl = audioUploadData.audioUrl;

                                        const transcribeResponse = await authenticatedFetch(`${API_BASE_URL}/api/speech-to-text/transcribe`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ audioUrl: audioFileUrl })
                                        });

                                        if (transcribeResponse.ok) {
                                            const transcribeData = await transcribeResponse.json();
                                            if (transcribeData.success && transcribeData.transcription) {
                                                setOcrResults(prev => ({ ...prev, [tempId]: transcribeData.transcription.trim() }));
                                                toast.success('🎬 Video speech transcribed!', { autoClose: 2000, toastId: `video-transcribe-done-${tempId}` });
                                            }
                                        }
                                    }
                                }
                            } catch (videoErr) {
                                console.error('Video audio extraction failed:', videoErr);
                                toast.warn('Could not extract audio from video. Sending as attachment only.', { autoClose: 3000 });
                            } finally {
                                setIsOcrExtracting(prev => ({ ...prev, [tempId]: false }));
                            }
                        })();
                    }

                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.log('Upload aborted');
                    } else {
                        toast.error(`Failed to upload ${file.name}`);
                    }
                    setPendingImages(prev => prev.filter(img => img.id !== tempId));
                }
            }

            if (files.length > 0) {
                toast.success(`${files.length} file(s) queued for attachment`);
            }
        } catch (error) {
            console.error('File upload error:', error);
            toast.error('Failed to upload files');
        } finally {
            setUploadingFile(false);
            setUploadProgress(0);
            setIsLoading(false);
        }
    };

    const removeUploadedFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddUrlToList = (e) => {
        if (e) e.preventDefault();

        const url = imageLinkInput.trim();
        if (!url) return;

        // Basic URL validation
        try {
            new URL(url);
        } catch (_) {
            toast.error('Invalid URL format');
            return;
        }

        // Check if already in list
        if (imageLinkUrls.includes(url)) {
            toast.info('This URL is already added');
            return;
        }

        // Check image limit
        const totalCount = pendingImages.length + imageLinkUrls.length;
        if (totalCount >= 5) {
            toast.error('You can only add up to 5 images. Please remove some before adding more.');
            return;
        }

        setImageLinkUrls(prev => [...prev, url]);
        setImageLinkInput('');
    };

    const handleRemoveUrlFromList = (urlToRemove) => {
        setImageLinkUrls(prev => prev.filter(url => url !== urlToRemove));
    };

    const handleImageLinkSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!currentUser) {
            toast.info('Please login to use image link');
            return;
        }

        // If there's still valid text in the input field, add it automatically first
        let finalUrls = [...imageLinkUrls];
        const inputUrl = imageLinkInput.trim();
        if (inputUrl) {
            try {
                new URL(inputUrl);
                const totalCount = pendingImages.length + finalUrls.length;
                if (totalCount < 5 && !finalUrls.includes(inputUrl)) {
                    finalUrls.push(inputUrl);
                }
            } catch (_) {}
        }

        if (finalUrls.length === 0) {
            toast.error('Please enter or add a valid image URL');
            return;
        }

        // Check image limit
        const currentImagesCount = pendingImages.length;
        const remainingCapacity = 5 - currentImagesCount;

        if (remainingCapacity <= 0) {
            toast.error('You can only upload up to 5 images. Please remove some before adding more.');
            return;
        }

        // If the number of pasted URLs exceeds remaining slots, limit it
        let urlsToAdd = finalUrls;
        if (finalUrls.length > remainingCapacity) {
            toast.warning(`Limit reached. Only adding the first ${remainingCapacity} valid image URLs.`);
            urlsToAdd = finalUrls.slice(0, remainingCapacity);
        }

        setImageLinkInput('');
        setImageLinkUrls([]);
        setShowImageLinkModal(false);

        // Add each URL
        for (const url of urlsToAdd) {
            const tempId = Date.now() + Math.random();

            // Add to pending images immediately with the original URL (no uploading state needed)
            setPendingImages(prev => [...prev, {
                id: tempId,
                name: 'External Image',
                type: 'image',
                url: url,
                uploading: false,
                isExternal: true
            }]);

            // Fetch the image via the backend proxy to bypass CORS on the client for OCR & Sentinel Audit
            (async () => {
                try {
                    const proxyUrl = `${API_BASE_URL}/api/upload/proxy-image?url=${encodeURIComponent(url)}`;
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error('Failed to fetch proxy image');
                    
                    const blob = await response.blob();
                    const file = new File([blob], 'external-image.jpg', { type: blob.type || 'image/jpeg' });

                    // Run facial recognition locally using blob Object URL
                    const localUrl = URL.createObjectURL(blob);
                    runFacialRecognition(localUrl, tempId);

                    // Run Sentinel audit on the proxied file object
                    performAudit(file, tempId, 'chat');

                    // Run OCR check in the background
                    try {
                        setIsOcrExtracting(prev => ({ ...prev, [tempId]: true }));
                        const text = await extractTextFromFile(file, (progressMsg) => {
                            console.log(`[OCR URL Image] ${progressMsg}`);
                        });
                        if (text && text.trim()) {
                            setOcrResults(prev => ({ ...prev, [tempId]: text.trim() }));
                        }
                    } catch (ocrErr) {
                        console.warn('OCR skipped/failed for URL image:', ocrErr);
                    } finally {
                        setIsOcrExtracting(prev => ({ ...prev, [tempId]: false }));
                    }
                } catch (error) {
                    console.warn('Failed to perform OCR & Audit via proxy:', error);
                }
            })();
        }
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

    // Save chat-specific settings to backend immediately
    const hasSettingsChanged = () => {
        if (!initialSettingsSnapshot) return false;
        return (
            tone !== initialSettingsSnapshot.tone ||
            aiResponseLength !== initialSettingsSnapshot.aiResponseLength ||
            aiCreativity !== initialSettingsSnapshot.aiCreativity ||
            dataRetention !== initialSettingsSnapshot.dataRetention ||
            messageLimit !== initialSettingsSnapshot.messageLimit ||
            temperature !== initialSettingsSnapshot.temperature ||
            topP !== initialSettingsSnapshot.topP ||
            enableStreaming !== initialSettingsSnapshot.enableStreaming ||
            contextWindow !== initialSettingsSnapshot.contextWindow ||
            showTimestamps !== initialSettingsSnapshot.showTimestamps ||
            autoScroll !== initialSettingsSnapshot.autoScroll ||
            fontSize !== initialSettingsSnapshot.fontSize ||
            messageDensity !== initialSettingsSnapshot.messageDensity ||
            soundEnabled !== initialSettingsSnapshot.soundEnabled ||
            typingSounds !== initialSettingsSnapshot.typingSounds ||
            enableAnalytics !== initialSettingsSnapshot.enableAnalytics ||
            enableErrorReporting !== initialSettingsSnapshot.enableErrorReporting ||
            selectedTheme !== initialSettingsSnapshot.selectedTheme ||
            autoSave !== initialSettingsSnapshot.autoSave ||
            enableMarkdown !== initialSettingsSnapshot.enableMarkdown ||
            enableCodeHighlighting !== initialSettingsSnapshot.enableCodeHighlighting
        );
    };

    const handleOpenSettings = () => {
        // Snapshot current settings before showing modal
        setInitialSettingsSnapshot({
            tone, aiResponseLength, aiCreativity, dataRetention, messageLimit,
            temperature, topP, enableStreaming, contextWindow, showTimestamps,
            autoScroll, fontSize, messageDensity, soundEnabled, typingSounds,
            enableAnalytics, enableErrorReporting, selectedTheme, autoSave,
            enableMarkdown, enableCodeHighlighting
        });
        setShowSettings(true);
        setIsHeaderMenuOpen(false);
    };

    const handleSettingsClose = () => {
        if (hasSettingsChanged()) {
            setShowUnsavedSettingsModal(true);
        } else {
            setShowSettings(false);
        }
    };

    const discardSettingsChanges = () => {
        if (initialSettingsSnapshot) {
            setTone(initialSettingsSnapshot.tone);
            setAiResponseLength(initialSettingsSnapshot.aiResponseLength);
            setAiCreativity(initialSettingsSnapshot.aiCreativity);
            setDataRetention(initialSettingsSnapshot.dataRetention);
            setMessageLimit(initialSettingsSnapshot.messageLimit);
            setTemperature(initialSettingsSnapshot.temperature);
            setTopP(initialSettingsSnapshot.topP);
            setEnableStreaming(initialSettingsSnapshot.enableStreaming);
            setContextWindow(initialSettingsSnapshot.contextWindow);
            setShowTimestamps(initialSettingsSnapshot.showTimestamps);
            setAutoScroll(initialSettingsSnapshot.autoScroll);
            setFontSize(initialSettingsSnapshot.fontSize);
            setMessageDensity(initialSettingsSnapshot.messageDensity);
            setSoundEnabled(initialSettingsSnapshot.soundEnabled);
            setTypingSounds(initialSettingsSnapshot.typingSounds);
            setEnableAnalytics(initialSettingsSnapshot.enableAnalytics);
            setEnableErrorReporting(initialSettingsSnapshot.enableErrorReporting);
            setSelectedTheme(initialSettingsSnapshot.selectedTheme);
            setAutoSave(initialSettingsSnapshot.autoSave);
            setEnableMarkdown(initialSettingsSnapshot.enableMarkdown);
            setEnableCodeHighlighting(initialSettingsSnapshot.enableCodeHighlighting);
        }
        setShowSettings(false);
        setShowUnsavedSettingsModal(false);
    };

    const handleSaveAllSettings = async () => {
        setIsSavingSettings(true);
        try {
            // 1. Save all to LocalStorage
            setUserSetting('gemini_tone', tone);
            setUserSetting('gemini_response_length', aiResponseLength);
            setUserSetting('gemini_creativity', aiCreativity);
            setUserSetting('gemini_data_retention', dataRetention);
            setUserSetting('gemini_message_limit', messageLimit);
            setUserSetting('gemini_temperature', temperature.toString());
            setUserSetting('gemini_top_p', topP.toString());
            setUserSetting('gemini_streaming', enableStreaming.toString());
            setUserSetting('gemini_context_window', contextWindow);
            setUserSetting('gemini_show_timestamps', showTimestamps.toString());
            setUserSetting('gemini_auto_scroll', autoScroll.toString());
            setUserSetting('gemini_font_size', fontSize);
            setUserSetting('gemini_message_density', messageDensity);
            setUserSetting('gemini_sound_enabled', soundEnabled.toString());
            setUserSetting('gemini_typing_sounds', typingSounds.toString());
            setUserSetting('gemini_analytics', enableAnalytics.toString());
            setUserSetting('gemini_error_reporting', enableErrorReporting.toString());
            setUserSetting('gemini_theme', selectedTheme);
            setUserSetting('gemini_auto_save', autoSave.toString());
            setUserSetting('gemini_enable_markdown', enableMarkdown.toString());
            setUserSetting('gemini_code_highlighting', enableCodeHighlighting.toString());

            // 2. Save Per-Chat settings to Backend
            if (currentUser) {
                const currentSessionId = getOrCreateSessionId();
                if (currentSessionId) {
                    const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            settings: {
                                tone,
                                responseLength: aiResponseLength,
                                creativity: aiCreativity,
                                dataRetention,
                                messageLimit,
                                temperature,
                                topP,
                                enableStreaming,
                                contextWindow
                            }
                        })
                    });
                    if (!response.ok) throw new Error('Failed to save to backend');
                }
            }

            // Update snapshot
            setInitialSettingsSnapshot({
                tone, aiResponseLength, aiCreativity, dataRetention, messageLimit,
                temperature, topP, enableStreaming, contextWindow, showTimestamps,
                autoScroll, fontSize, messageDensity, soundEnabled, typingSounds,
                enableAnalytics, enableErrorReporting, selectedTheme, autoSave,
                enableMarkdown, enableCodeHighlighting
            });

            toast.success('Settings saved successfully!');
            setShowSettings(false);
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings to server.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleSettingsSync = async (silent = false) => {
        setIsSyncingSettings(true);
        try {
            await syncSessionSettings();
            if (!silent) {
                toast.success('Synced with latest preferences');
            }
        } catch (error) {
            if (!silent) {
                toast.error('Failed to sync settings');
            }
        } finally {
            setIsSyncingSettings(false);
        }
    };

    const saveChatSettingsToBackend = async (settingKey, settingValue) => {
        if (!currentUser) return;
        const currentSessionId = getOrCreateSessionId();
        if (!currentSessionId) return;

        try {
            await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: { [settingKey]: settingValue }
                })
            });
        } catch (error) {
            console.error('Error saving chat setting:', settingKey, error);
        }
    };

    const syncSessionSettings = async () => {
        if (!currentUser) return;
        const currentSessionId = getOrCreateSessionId();
        if (!currentSessionId) return;

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}?limit=1`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.settings) {
                    applySessionSettings(data.data.settings);
                }
            }
        } catch (error) {
            console.error('Error syncing session settings:', error);
            throw error; // Rethrow to handle in the caller
        }
    };

    const updateTone = (value) => {
        setTone(value);
        if (!showSettings) {
            setUserSetting('gemini_tone', value);
            saveChatSettingsToBackend('tone', value);
        }
    };

    const updateAiResponseLength = (length) => {
        setAiResponseLength(length);
        if (!showSettings) {
            setUserSetting('gemini_response_length', length);
            saveChatSettingsToBackend('responseLength', length);
        }
    };

    const updateAiCreativity = (creativity) => {
        setAiCreativity(creativity);
        if (!showSettings) {
            setUserSetting('gemini_creativity', creativity);
            saveChatSettingsToBackend('creativity', creativity);
        }
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
        if (!showSettings) {
            setUserSetting('gemini_data_retention', days);
            saveChatSettingsToBackend('dataRetention', days);
        }
    };

    // Advanced Settings Helper Functions
    const updateAutoSave = (enabled) => {
        setAutoSave(enabled);
        setUserSetting('gemini_auto_save', enabled.toString());
    };

    const updateMessageLimit = (limit) => {
        setMessageLimit(limit);
        if (!showSettings) {
            setUserSetting('gemini_message_limit', limit);
            saveChatSettingsToBackend('messageLimit', limit);
        }
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
        if (!showSettings) {
            setUserSetting('gemini_temperature', value);
            saveChatSettingsToBackend('temperature', value.toString());
        }
    };

    const updateTopP = (value) => {
        setTopP(value);
        if (!showSettings) {
            setUserSetting('gemini_top_p', value);
            saveChatSettingsToBackend('topP', value.toString());
        }
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
        if (!showSettings) {
            setUserSetting('gemini_streaming', enabled.toString());
            saveChatSettingsToBackend('enableStreaming', enabled.toString());
        }
    };

    const updateEnableContextMemory = (enabled) => {
        setEnableContextMemory(enabled);
        setUserSetting('gemini_context_memory', enabled.toString());
    };

    const updateContextWindow = (value) => {
        setContextWindow(value);
        if (!showSettings) {
            setUserSetting('gemini_context_window', value);
            saveChatSettingsToBackend('contextWindow', value);
        }
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
            const audio = new Audio(`/assets/sounds/${soundFile}`);
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
            const audio = new Audio('/assets/sounds/typing.mp3');
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
            if (dataRetention === '0' || dataRetention === 0 || dataRetention === 'forever') return; // Forever - no cleanup

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

            // NOTE: We intentionally do NOT filter messages from the current active session here.
            // The frontend only has a partial/paginated view of messages, so removing messages
            // from local state would cause data loss if any sync (edit/version switch) sends
            // this truncated state back to the server, permanently overwriting the full DB history.
            // Message-level retention cleanup should only be done server-side where the full
            // message history is available.
        } catch (error) {
            console.error('Error in data retention cleanup:', error);
        }
    };

    const handleSmartSuggestion = (suggestion) => {
        setInputMessage(suggestion);
        // Don't permanently disable smart suggestions - they should be controlled by message count
        inputRef.current?.focus();
    };

    const handleLoadMoreSuggestions = async () => {
        if (isLoadingMoreSuggestions || !canLoadMoreSuggestions) return;

        // Check limit
        if (suggestionLoadCount >= 5) {
            toast.warning('Refresh limit reached. Please wait a minute for rest.', { icon: '⏳' });
            setCanLoadMoreSuggestions(false);
            return;
        }

        setIsLoadingMoreSuggestions(true);
        try {
            const currentSessionId = sessionId || localStorage.getItem('gemini_session_id');
            const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    currentSuggestions: smartSuggestions
                })
            });

            const data = await res.json();
            if (data.success && data.suggestions && data.suggestions.length > 0) {
                setSmartSuggestions(data.suggestions);
                setSuggestionLoadCount(prev => prev + 1);

                // Add suggestion tokens to current session total and lifetime
                if (data.usage && data.usage.total_tokens) {
                    const tokensAdded = data.usage.total_tokens;
                    setActiveSessionTokens(prev => prev + tokensAdded);
                    setLifetimeUsage(prev => ({
                        ...prev,
                        totalTokens: (prev.totalTokens || 0) + tokensAdded
                    }));
                }

                toast.success('Suggestions updated!', { icon: '✨' });
            } else {
                toast.error('Failed to get new suggestions');
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            toast.error('Could not load more suggestions');
        } finally {
            setIsLoadingMoreSuggestions(false);
        }
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

        // Pre-process: Convert raw HTML <a> tags from LLM output to markdown links
        // This prevents raw HTML attributes from showing as visible text
        processedText = processedText.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, (match, url, linkText) => {
            return `[${linkText || url}](${url})`;
        });

        // Strip any remaining raw HTML tags (except our own generated ones) to prevent attribute leakage
        // Preserve <br>, <strong>, <em> etc. that we generate, but remove unknown tags
        processedText = processedText.replace(/<(?!\/?(br|strong|em|h[1-6]|li|ul|ol|table|thead|tbody|tr|th|td|div|span|pre|code|svg|path|rect|button|img)\b)[^>]+>/gi, '');

        // Mask code blocks and inline code to protect them from other parsing rules (like math delimiters or list items)
        const codeBlocks = [];
        processedText = processedText.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
            codeBlocks.push({ type: 'block', language, code, match });
            return `%%CODEBLOCKPLACEHOLDER${codeBlocks.length - 1}%%`;
        });
        processedText = processedText.replace(/`([^`]+)`/g, (match, code) => {
            codeBlocks.push({ type: 'inline', code, match });
            return `%%INLINECODEPLACEHOLDER${codeBlocks.length - 1}%%`;
        });

        // Parse LaTeX math expressions
        // 1. Render boxed equations (e.g. \boxed{50} or $\boxed{50}$)
        processedText = processedText.replace(/(?:\$\$|\$)?\\boxed\{([^\}]+)\}(?:\$\$|\$)?/g, (match, content) => {
            return `<span class="inline-flex items-center justify-center border border-blue-500/40 dark:border-blue-400/40 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-md shadow-sm select-all mx-1 font-mono">${content}</span>`;
        });

        // 2. Render display math blocks (e.g. $$x = 5$$)
        processedText = processedText.replace(/\$\$(.*?)\$\$/g, '<div class="math-block text-center my-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg font-mono text-sm overflow-x-auto border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200">$1</div>');

        // 3. Render inline math (e.g. $x$ or $10x = 50$, avoiding currency matching)
        processedText = processedText.replace(/\$(?!\s)([^\$]+?)(?<!\s)\$/g, (match, content) => {
            if (/^\d+(?:\.\d+)?$/.test(content)) return match;
            const hasMathSymbol = /[\=+\-*\/\\()_^{}<>≤≥≠≈±×÷]/.test(content);
            if (!hasMathSymbol && content.length > 5) return match;
            return `<span class="math-inline font-mono bg-gray-100 dark:bg-gray-800/80 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">${content}</span>`;
        });

        // 4. Clean up common LaTeX symbols inside text
        processedText = processedText
            .replace(/\\times/g, '×')
            .replace(/\\div/g, '÷')
            .replace(/\\cdot/g, '·')
            .replace(/\\le/g, '≤')
            .replace(/\\leq/g, '≤')
            .replace(/\\ge/g, '≥')
            .replace(/\\geq/g, '≥')
            .replace(/\\ne/g, '≠')
            .replace(/\\neq/g, '≠')
            .replace(/\\approx/g, '≈')
            .replace(/\\pm/g, '±')
            .replace(/\\infty/g, '∞')
            .replace(/\\alpha/g, 'α')
            .replace(/\\beta/g, 'β')
            .replace(/\\gamma/g, 'γ')
            .replace(/\\delta/g, 'δ')
            .replace(/\\theta/g, 'θ')
            .replace(/\\pi/g, 'π')
            .replace(/\\sigma/g, 'σ')
            .replace(/\\omega/g, 'ω')
            .replace(/\\sqrt\{([^\}]+)\}/g, '√$1')
            .replace(/([a-zA-Z0-9])\^([0-9a-zA-Z\+\-]+)/g, '$1<sup>$2</sup>')
            .replace(/([a-zA-Z0-9])\^\{([^\}]+)\}/g, '$1<sup>$2</sup>')
            .replace(/([a-zA-Z0-9])_([0-9a-zA-Z\+\-]+)/g, '$1<sub>$2</sub>')
            .replace(/([a-zA-Z0-9])_\{([^\}]+)\}/g, '$1<sub>$2</sub>');

        // Restore and parse masked code blocks and inline code
        for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];
            let htmlReplacement = '';
            
            if (block.type === 'block') {
                let lang = block.language || 'text';
                const cleanCode = block.code.trim();
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
                        const highlightedCode = Prism.highlight(cleanCode, Prism.languages[lang] || Prism.languages.text, lang);
                        htmlReplacement = `<div class="code-block relative group my-4 rounded-lg overflow-hidden border border-gray-700 dark:border-gray-600 bg-gray-900 dark:bg-gray-800">
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
                        htmlReplacement = `<div class="code-block relative group my-4 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
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
                    htmlReplacement = `<div class="code-block relative group my-4 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                        <div class="flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                            <span class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">${lang}</span>
                            <button class="code-copy-btn p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center" aria-label="Copy code" title="Copy code" data-code="${encodeURIComponent(cleanCode)}">
                                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1.2em" width="1.2em" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                        <pre class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 p-4 overflow-x-auto border-none m-0"><code class="language-${lang}">${cleanCode}</code></pre>
                    </div>`;
                }
                processedText = processedText.replace(`%%CODEBLOCKPLACEHOLDER${i}%%`, htmlReplacement);
            } else if (block.type === 'inline') {
                htmlReplacement = `<code class="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono border border-gray-300 dark:border-gray-600">${block.code}</code>`;
                processedText = processedText.replace(`%%INLINECODEPLACEHOLDER${i}%%`, htmlReplacement);
            }
        }
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
            .replace(/^###### (.*$)/gim, '<h6 class="text-[10px] font-bold mt-2 mb-1 text-gray-400 dark:text-gray-500 uppercase tracking-wider">$1</h6>') // H6
            .replace(/^##### (.*$)/gim, '<h5 class="text-xs font-bold mt-2 mb-1 text-gray-300 dark:text-gray-400">$1</h5>') // H5
            .replace(/^#### (.*$)/gim, '<h4 class="text-sm font-semibold mt-3 mb-1 text-gray-200 dark:text-gray-300">$1</h4>') // H4
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>') // H3
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>') // H2
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>') // H1
            .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>') // Bullet points
            .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>') // Numbered lists
            .replace(/\n/g, '<br>'); // Line breaks

        return processedText;
    };

    // Combined function to render text with both links and markdown
    const renderTextWithMarkdownAndLinks = (text, isSentMessage = false, message = null) => {
        if (!text || typeof text !== 'string') return text;

        // Clean up the text if it claims to have generated cards but no recommendations are present
        let cleanedText = text;
        if (message && message.role === 'assistant' && (!message.recommendations || message.recommendations.length === 0)) {
            // Remove "I've generated some detailed cards for you below! ↓" or "👇" or similar endings
            cleanedText = cleanedText
                .replace(/I've generated some detailed cards for you below!\s*[↓👇]?/gi, '')
                .trim();
        }

        // Clean up `<confirm-cancel>` tags from display text
        const confirmCancelRegex = /<confirm-cancel\s+id=["']([^"']+)["']\s+text=["']([^"']+)["']\s*(?:\/>|>\s*<\/confirm-cancel>)/gi;
        cleanedText = cleanedText.replace(confirmCancelRegex, '').trim();

        // If markdown is disabled, just use link formatting
        if (!enableMarkdown) {
            return formatTextWithLinks(cleanedText, isSentMessage);
        }

        // First process markdown
        const markdownProcessed = renderMarkdown(cleanedText);

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

            // Handle image filenames in response (Task 2)
            // Pattern: something.png, something.jpg, something.jpeg, something.webp (case insensitive)
            const imagePattern = /\b([a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp))\b/gi;
            if (imagePattern.test(restoredPart)) {
                const imgParts = restoredPart.split(imagePattern);
                return (
                    <span key={index} className={isSentMessage ? "text-white" : ""}>
                        {imgParts.map((item, i) => {
                            if (i % 2 === 1) {
                                // This is an image filename
                                // Try to find the image URL in message history or current message
                                let foundImgUrl = null;

                                // Look in current message first
                                const currentImages = message?.images || (message?.imageUrl ? [message.imageUrl] : []);
                                foundImgUrl = currentImages.find(url => url.toLowerCase().includes(item.toLowerCase()));

                                // If not found, check previous messages (max 10)
                                if (!foundImgUrl) {
                                    const reversedMessages = [...messages].reverse().slice(0, 10);
                                    for (const prevMsg of reversedMessages) {
                                        const prevImages = prevMsg.images || (prevMsg.imageUrl ? [prevMsg.imageUrl] : []);
                                        foundImgUrl = prevImages.find(url => url.toLowerCase().includes(item.toLowerCase()));
                                        if (foundImgUrl) break;
                                    }
                                }

                                if (foundImgUrl) {
                                    return (
                                        <span
                                            key={i}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewImages([foundImgUrl]);
                                                setPreviewImageIndex(0);
                                                setIsImagePreviewOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 mx-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:bg-blue-500/20 transition-all group"
                                            title="View Image"
                                        >
                                            <FaImage className="text-sm group-hover:scale-110 transition-transform" />
                                            <span className="underline decoration-dotted underline-offset-4">{item}</span>
                                        </span>
                                    );
                                }
                                return item;
                            }
                            return <span key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item) }} />;
                        })}
                    </span>
                );
            }

            return <span key={index} className={isSentMessage ? "text-white" : ""} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(restoredPart) }} />;
        });
    };

    const renderConfirmationBubble = (message, msgIndex) => {
        if (message.role !== 'assistant' || !message.content) return null;

        const confirmCancelRegex = /<confirm-cancel\s+id=["']([^"']+)["']\s+text=["']([^"']+)["']\s*(?:\/>|>\s*<\/confirm-cancel>)/i;
        const match = message.content.match(confirmCancelRegex);
        if (!match) return null;

        const reminderId = match[1];
        const reminderText = match[2];

        // Unique radio name for this message to prevent conflict across messages
        const radioName = `confirm_cancel_${reminderId}`;

        // Disable options if already executed or if there is a subsequent user message
        const hasSubsequentUserMessage = msgIndex !== undefined && messages.slice(msgIndex + 1).some(m => m.role === 'user');
        const isExecuted = message.confirmationExecuted || hasSubsequentUserMessage;
        
        let selectedChoice = message.confirmationSelected;
        if (!selectedChoice && msgIndex !== undefined) {
            // Fallback: Infer selection from subsequent user messages in case state is refreshed or history is loaded
            const subsequentUserMsg = messages.slice(msgIndex + 1).find(m => m.role === 'user');
            if (subsequentUserMsg && subsequentUserMsg.content) {
                const text = subsequentUserMsg.content.toLowerCase();
                if (text.includes('yes, cancel') || text.includes('yes, cancel the reminder')) {
                    selectedChoice = 'yes';
                } else if (text.includes('no, keep') || text.includes('keep my reminder')) {
                    selectedChoice = 'no';
                }
            }
        }

        const isSelectedYes = selectedChoice === 'yes';
        const isSelectedNo = selectedChoice === 'no';

        const handleOptionClick = async (optionText, choice, cancelId) => {
            // Mark this confirmation bubble as executed immediately
            if (msgIndex !== undefined) {
                setMessages(prev => {
                    const copy = [...prev];
                    if (copy[msgIndex]) {
                        copy[msgIndex] = {
                            ...copy[msgIndex],
                            confirmationExecuted: true,
                            confirmationSelected: choice
                        };
                    }
                    return copy;
                });
            }

            if (choice === 'yes' && cancelId) {
                // DIRECT API CALL — bypass AI to prevent misinterpretation / phantom reminders
                try {
                    if (cancelId === 'ALL') {
                        // Fetch all active reminders and cancel each one directly
                        const listRes = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders`);
                        if (listRes.ok) {
                            const listData = await listRes.json();
                            const activeOnes = (listData.reminders || []).filter(
                                r => r.status === 'scheduled' || r.status === 'snoozed' || r.status === 'triggered'
                            );
                            if (activeOnes.length === 0) {
                                toast.info("No active reminders to cancel.");
                            } else {
                                let successCount = 0;
                                for (const r of activeOnes) {
                                    const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${r._id}`, { method: 'DELETE' });
                                    if (res.ok) successCount++;
                                }
                                toast.success(`${successCount} reminder(s) cancelled successfully.`);
                                fetchReminders();
                            }
                        } else {
                            toast.error("Failed to fetch reminders for bulk cancellation.");
                        }
                    } else {
                        // Single reminder — cancel directly
                        const res = await authenticatedFetch(`${API_BASE_URL}/api/gemini/reminders/${cancelId}`, { method: 'DELETE' });
                        if (res.ok) {
                            toast.success("Reminder cancelled successfully.");
                            fetchReminders();
                        } else {
                            const errData = await res.json().catch(() => ({}));
                            toast.error(errData.message || "Failed to cancel reminder.");
                        }
                    }
                } catch (err) {
                    console.error("Error cancelling reminder from confirmation:", err);
                    toast.error("Error cancelling reminder.");
                }
            } else {
                // "No" — just let AI know the user chose to keep it
                setInputMessage(optionText);
                handleSubmit(null, optionText);
            }
        };

        return (
            <div className={`mt-3 p-4 rounded-xl border ${isDarkMode ? 'bg-gray-900/60 border-gray-700/85 text-gray-200' : 'bg-white border-gray-200 text-gray-800'} shadow-md select-none`}>
                <div className="flex items-center gap-2 mb-3">
                    <span className="p-1 px-2.5 bg-red-500/10 text-red-500 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                        Action Required
                    </span>
                    <h4 className="text-xs font-bold text-gray-750 dark:text-gray-300">
                        Confirm Reminder Cancellation
                    </h4>
                </div>
                <p className="text-xs mb-3 text-gray-600 dark:text-gray-400 font-medium">
                    Are you sure you want to cancel the reminder for <strong className="font-bold text-red-500">"{reminderText}"</strong>?
                </p>
                <div className="space-y-2.5">
                    {/* Radio Button 1: Yes, cancel */}
                    <div 
                        onClick={isExecuted ? null : () => handleOptionClick(`Yes, cancel the reminder "${reminderText}" with ID "${reminderId}"`, 'yes', reminderId)}
                        className={`flex items-center gap-2.5 p-2 px-3 rounded-lg border transition-all ${
                            isExecuted 
                                ? `cursor-not-allowed ${
                                    isSelectedYes 
                                        ? (isDarkMode 
                                            ? 'bg-red-500/10 border-red-500/30 text-red-300' 
                                            : 'bg-red-50 border-red-200 text-red-700')
                                        : 'bg-gray-100/5 dark:bg-gray-800/10 border-transparent opacity-40 text-gray-500'
                                }` 
                                : `cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                                    isDarkMode 
                                        ? 'bg-gray-850 hover:bg-red-950/20 border-gray-850 hover:border-red-900/50 text-gray-300' 
                                        : 'bg-gray-50 hover:bg-red-50 border-gray-50 hover:border-red-200 text-gray-700'
                                }`
                        }`}
                    >
                        <input
                            type="radio"
                            name={radioName}
                            id={`${radioName}_yes`}
                            className={`text-red-500 focus:ring-red-400 h-3.5 w-3.5 ${isExecuted ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                            onChange={() => {}} // Controlled by wrapper div click
                            checked={isSelectedYes}
                            disabled={isExecuted}
                        />
                        <label htmlFor={`${radioName}_yes`} className={`text-xs font-bold flex-1 ${isExecuted ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            Yes, cancel the reminder: "{reminderText}"
                        </label>
                    </div>

                    {/* Radio Button 2: No, keep */}
                    <div 
                        onClick={isExecuted ? null : () => handleOptionClick(`No, keep my reminder`, 'no')}
                        className={`flex items-center gap-2.5 p-2 px-3 rounded-lg border transition-all ${
                            isExecuted 
                                ? `cursor-not-allowed ${
                                    isSelectedNo 
                                        ? (isDarkMode 
                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' 
                                            : 'bg-blue-50 border-blue-200 text-blue-700')
                                        : 'bg-gray-100/5 dark:bg-gray-800/10 border-transparent opacity-40 text-gray-500'
                                }` 
                                : `cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                                    isDarkMode 
                                        ? 'bg-gray-850 hover:bg-blue-950/25 border-gray-850 hover:border-blue-900/50 text-gray-300' 
                                        : 'bg-gray-50 hover:bg-blue-50 border-gray-50 hover:border-blue-200 text-gray-700'
                                }`
                        }`}
                    >
                        <input
                            type="radio"
                            name={radioName}
                            id={`${radioName}_no`}
                            className={`text-blue-500 focus:ring-blue-400 h-3.5 w-3.5 ${isExecuted ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                            onChange={() => {}} // Controlled by wrapper div click
                            checked={isSelectedNo}
                            disabled={isExecuted}
                        />
                        <label htmlFor={`${radioName}_no`} className={`text-xs font-bold flex-1 ${isExecuted ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            No, keep this reminder
                        </label>
                    </div>
                </div>
            </div>
        );
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
        if (!currentUser) {
            return;
        }

        // Prevent auto-save if only system messages (like welcome message) exist
        const hasUserMessage = messages.some(m => m.role === 'user');
        if (!hasUserMessage) {
            return;
        }

        try {
            const currentSessionId = getOrCreateSessionId();

            if (!currentSessionId) {
                return;
            }

            // IMPORTANT: Do NOT send messages here!
            // The backend chatWithGemini controller already saves messages when the AI responds.
            // Sending messages from auto-save creates a race condition where stale frontend state
            // overwrites the DB, causing messages to vanish.
            // Auto-save only syncs per-chat settings to the backend.
            const chatSettings = {
                messageLimit,
                dataRetention,
                tone,
                responseLength: aiResponseLength,
                creativity: aiCreativity,
                temperature: temperature?.toString() || '0.7',
                topP: topP?.toString() || '0.9',
                contextWindow: contextWindow?.toString() || '4',
                enableStreaming: enableStreaming?.toString() || 'false'
            };

            console.log('Auto-saving chat settings:', currentSessionId);

            const saveResponse = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    settings: chatSettings,
                    lastActivity: new Date().toISOString()
                })
            });

            if (saveResponse.ok) {
                console.log('Chat settings auto-saved successfully');
            } else {
                console.error('Failed to auto-save chat settings:', saveResponse.status, saveResponse.statusText);
            }
        } catch (error) {
            console.error('Error auto-saving chat settings:', error);
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
                <div className="relative group w-12 h-12">
                    {/* Quick Action Buttons */}
                    {!isOpen && (
                        <div className="absolute right-full top-1/2 -translate-y-1/2 flex flex-row-reverse items-center gap-3 pr-5 opacity-0 scale-75 translate-x-10 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-500 ease-out z-50">
                            <button
                                onClick={() => {
                                    if (isBlockedByPolicy) {
                                        toast.warning('File upload is disabled during your policy cooldown.');
                                        return;
                                    }
                                    if (!currentUser) {
                                        toast.info('Please login to upload files');
                                        return;
                                    }
                                    setIsOpen(true);
                                    setTimeout(() => setShowFileUpload(true), 100);
                                }}
                                disabled={isBlockedByPolicy}
                                className={`w-11 h-11 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border border-white/20 ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                title="Upload File"
                            >
                                <FaUpload size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (isBlockedByPolicy) {
                                        toast.warning('Voice input is disabled during your policy cooldown.');
                                        return;
                                    }
                                    if (!currentUser) {
                                        toast.info('Please login to use voice input');
                                        return;
                                    }
                                    setIsOpen(true);
                                    // Delay voice input slightly to allow modal animation to start
                                    setTimeout(() => {
                                        if (typeof toggleVoiceInput === 'function') {
                                            toggleVoiceInput();
                                        }
                                        setShowVoiceInput(true);
                                    }, 600);
                                }}
                                disabled={isBlockedByPolicy}
                                className={`w-11 h-11 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border border-white/20 ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                title="Voice Input"
                            >
                                <FaMicrophone size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (isBlockedByPolicy) {
                                        toast.warning('Starting a new chat is disabled during your policy cooldown.');
                                        return;
                                    }
                                    createNewSession();
                                    setIsOpen(true);
                                }}
                                disabled={isBlockedByPolicy}
                                className={`w-11 h-11 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border border-white/20 ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                title="New Chat"
                            >
                                <FaComments size={16} />
                            </button>
                        </div>
                    )}



                    <button
                        onClick={isOpen ? handleClose : handleOpen}
                        className={`relative group w-12 h-12 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-12 flex items-center justify-center border border-white/20 dark:border-gray-700/30 ${isDarkMode ? 'bg-gray-900' : `bg-white`
                            }`}
                        aria-label="Open AI Chat"
                        title="Chat with SetuAI Assistant!"
                    >
                        {/* Inner container for background and shine - with overflow-hidden */}
                        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                            {/* Dynamic Background */}
                            <div className={`absolute inset-0 transition-opacity duration-500 opacity-90 z-0 ${isDarkMode ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-black' : `bg-gradient-to-br ${themeColors.primary}`
                                }`} />

                            {/* Animated Glass Glow (Shine) */}
                            {!isOpen && (
                                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-white/20 dark:bg-white/10 rotate-[35deg] transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            )}
                        </div>

                        {/* Animated background ripple - Ping Effect (Synchronized with Support) */}
                        {!isOpen && (
                            <div
                                className="absolute inset-0 rounded-full animate-ping pointer-events-none z-0"
                                style={{
                                    border: `4px solid ${getThemeRingColor()}ee`, // Use 'ee' (93%) for high visibility
                                }}
                            ></div>
                        )}

                        {/* Animated outer pulse glow */}
                        {!isOpen && (
                            <div
                                className={`absolute inset-[-4px] rounded-full border-2 blur-[3px] animate-pulse transition-opacity duration-300`}
                                style={{ borderColor: `${getThemeRingColor()}99` }}
                            />
                        )}

                        {/* Icon with sparkle effect */}
                        <div className="relative z-10 transition-transform duration-300 group-hover:scale-110">
                            {isOpen ? (
                                <FaTimes className="w-5 h-5 text-white drop-shadow-lg animate-fadeIn" />
                            ) : (
                                <div className="relative flex items-center justify-center">
                                    {!isOpen && (
                                        <div className="absolute -top-4 left-[62%] -translate-x-1/2 z-20 pointer-events-none group-hover:scale-110 transition-transform duration-300">
                                            {hasChatError ? (
                                                <div className="relative flex items-center justify-center animate-pulse">
                                                    <FaWifi className={`text-[15px] ${isDarkMode ? 'text-red-400/60' : 'text-red-300/60'} rotate-[20deg]`} />
                                                    <FaTimes className="absolute text-[10px] text-white drop-shadow-[0_0_4px_rgba(239,68,68,0.9)]" />
                                                </div>
                                            ) : (
                                                <FaWifi
                                                    className={`text-[15px] animate-bandwidth rotate-[20deg] drop-shadow-[0_0_8px_rgba(96,165,250,0.9)]`}
                                                    style={{ color: isDarkMode ? getThemeRingColor() : 'white' }}
                                                />
                                            )}
                                        </div>
                                    )}
                                    {isLoading ? (
                                        <div className="relative">
                                            <FaRobot
                                                className="w-5 h-5 animate-pulse drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                                                style={{ color: isDarkMode ? getThemeRingColor() : 'white' }}
                                            />
                                            <div
                                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping"
                                                style={{ backgroundColor: isDarkMode ? getThemeRingColor() : 'white' }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <FaRobot
                                            className="w-5 h-5 drop-shadow-lg transition-colors duration-300"
                                            style={{ color: isDarkMode ? getThemeRingColor() : 'white' }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>


                        {!isOpen && unreadCount > 0 && (
                            <div className="absolute top-0 right-0 z-20 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-xl animate-bounce">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                        )}

                        {/* Enhanced Hover Tooltip */}
                        {!isOpen && (
                            <div className={`absolute bottom-full right-0 mb-3 ${isDarkMode ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-gray-800 border-gray-100'
                                } text-sm px-4 py-2 rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-100 z-50 whitespace-nowrap border`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🤖</span>
                                    <span className="font-medium">Ask SetuAI about properties!</span>
                                </div>
                                {/* Tooltip arrow */}
                                <div className={`absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${isDarkMode ? 'border-t-gray-800' : 'border-t-white'
                                    }`}></div>
                            </div>
                        )}
                    </button>

                    {/* Try SETUAI Expansion Prompt */}
                    {showTryPrompt && !isOpen && (
                        <div className="absolute bottom-full right-0 mb-5 flex items-center animate-[slideUp_0.5s_ease-out] drop-shadow-2xl z-40 max-w-[90vw] md:max-w-xs">
                            <div className={`relative px-5 py-3 rounded-2xl whitespace-nowrap overflow-hidden group shadow-2xl border border-white/20 dark:border-gray-700/50 ${isDarkMode ? 'bg-gray-800/95 text-white' : 'bg-white/95 text-gray-900'} backdrop-blur-md`}>
                                {/* Progress bar background */}
                                <div
                                    className="absolute bottom-0 left-0 h-1 w-full animate-[shrink_6s_linear]"
                                    style={{ backgroundColor: `${getThemeRingColor()}4d` }} // 30% opacity
                                />

                                <div className="flex items-center gap-3">
                                    <div
                                        className={`p-1.5 rounded-lg ${!isDarkMode ? themeColors.secondary : ''}`}
                                        style={isDarkMode ? { backgroundColor: `${getThemeRingColor()}33`, color: getThemeRingColor() } : {}}
                                    >
                                        <FaMagic size={14} className={`animate-pulse ${!isDarkMode ? themeColors.accent : ''}`} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black tracking-tight leading-none mb-0.5">Meet SETUAI 🤖</span>
                                        <span className="text-[11px] opacity-70 font-medium truncate max-w-[120px] sm:max-w-none">Smart Property Assistant active</span>
                                    </div>
                                    <button
                                        onClick={() => handleOpen()}
                                        className={`ml-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-105 active:scale-95 ${!isDarkMode ? `${themeColors.secondary} ${themeColors.accent} hover:opacity-80` : 'text-white hover:opacity-90'}`}
                                        style={isDarkMode ? { backgroundColor: getThemeRingColor() } : {}}
                                    >
                                        Try Now
                                    </button>
                                </div>

                                {/* Arrow */}
                                <div className={`absolute -bottom-2 right-6 w-4 h-4 rotate-45 border-r border-b ${isDarkMode ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white/95 border-gray-200'
                                    }`} />
                            </div>
                        </div>
                    )}
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
                        {/* New Chat Session Creation Loading Overlay */}
                        {isLoadingNewSession && (
                            <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex flex-col items-center justify-center z-[60] rounded-[inherit] animate-fadeIn">
                                <UrbanSetuSpinner size="md" />
                                <p className="text-sm text-white mt-3 font-semibold tracking-wide">Creating new chat...</p>
                            </div>
                        )}
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
                                    <div className="p-1.5 md:p-2 bg-white/10 rounded-lg border border-white/20 relative overflow-visible">
                                        {/* Dynamic Header WiFi Aura/Icon */}
                                        {(isLoading || showTypingIndicator || hasChatError) && (
                                            <div className="absolute -top-3.5 -right-2 z-20 pointer-events-none transition-all duration-300">
                                                {hasChatError ? (
                                                    <div className="relative flex items-center justify-center translate-x-1 -translate-y-1">
                                                        <FaWifi className="text-[22px] text-red-400 rotate-[20deg] drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                                                        <div className="absolute -top-1 -right-1 z-30">
                                                            <div className="bg-red-500 text-white rounded-full w-[13px] h-[13px] flex items-center justify-center border border-white shadow-xl ring-1 ring-red-900/40">
                                                                <FaTimes size={7} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <FaWifi className="text-[22px] text-white animate-bandwidth rotate-[20deg] drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
                                                )}
                                            </div>
                                        )}
                                        <FaRobot size={16} className={`transition-all duration-500 ${isLoading || showTypingIndicator ? 'text-blue-200 animate-pulse' : 'opacity-90 text-white'}`} />
                                    </div>
                                    {/* Online status indicator with ping effect */}
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 flex items-center justify-center">
                                        <div className={`absolute inset-0 rounded-full border-2 border-white ${hasChatError ? 'bg-red-500' :
                                            isLoading || showTypingIndicator ? 'bg-blue-400' : 'bg-green-400'
                                            }`}></div>
                                        <div className={`w-full h-full rounded-full animate-ping opacity-75 ${hasChatError ? 'bg-red-500' :
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
                                    <div className="text-[10px] md:text-xs text-white/80 flex items-center gap-1 min-w-0">
                                        {hasChatError ? (
                                            <span>Chat Error Detected</span>
                                        ) : isLoading ? (
                                            <ScrollingThinkingTags isHeader={true} isScheduler={isCurrentRequestScheduler} schedulerType={currentSchedulerType} isDeepThinking={isCurrentRequestDeepThinking} isWebSearch={isCurrentRequestWebSearch} mediaType={currentRequestMediaType} />
                                        ) : showTypingIndicator ? (
                                            <span>Answering...</span>
                                        ) : (
                                            <span className="truncate">{displayedTitle !== 'SetuAI' ? 'Active Chat • Powered by SetuAI' : 'Online • Real Estate Expert Powered by Sentinel v2.0'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Right controls */}
                            <div className="flex items-center gap-1 relative flex-shrink-0">
                                {policyViolations > 0 && (
                                    <button
                                        onClick={() => setShowViolationModal(true)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 border ${isBlockedByPolicy
                                            ? 'bg-red-500/20 text-red-100 hover:bg-red-500/30 animate-pulse border-red-500/30'
                                            : 'text-white/70 hover:text-white hover:bg-white/10 border-transparent hover:border-white/20'
                                            }`}
                                        title={isBlockedByPolicy ? "Policy Restriction Active - Click for Details" : `Safety Policy Status (${policyViolations}/${VIOLATION_LIMIT})`}
                                        aria-label="View Policy Status"
                                    >
                                        <FaShieldAlt className="text-sm" />
                                    </button>
                                )}

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
                                            {/* Session Usage / Tokens */}
                                            <li>
                                                <div
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/10' : 'hover:bg-gray-50/50'} flex items-center gap-3 transition-all duration-200 cursor-default group`}
                                                    title={`Tokens used in this session (Prompt, Completion, Suggestions, Total)`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-600">
                                                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                                                            <text x="12" y="15" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">T</text>
                                                        </svg>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 opacity-80">Current Session Usage</span>
                                                        <span className={`font-semibold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                                                            {/* Show total session tokens including extra out-of-band ones */}
                                                            {Math.max(activeSessionTokens, messages.reduce((sum, msg) => sum + (msg.tokenUsage?.totalTokens || 0), 0)).toLocaleString()} <span className="text-[10px] opacity-70">tokens</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>

                                            <li className={`border-t ${isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'} my-1`}></li>

                                            {/* New Chat */}
                                            <li>
                                                <button
                                                    onClick={() => {
                                                        if (isBlockedByPolicy) {
                                                            toast.warning('Starting a new chat is disabled during your policy cooldown.');
                                                            return;
                                                        }
                                                        createNewSession();
                                                        setIsHeaderMenuOpen(false);
                                                    }}
                                                    disabled={isBlockedByPolicy}
                                                    className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-[1.02] group'}`}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'} ${isBlockedByPolicy ? '' : 'group-hover:scale-110'} transition-transform duration-200`}>
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
                                                <li>
                                                    <button
                                                        onClick={() => { navigate('/admin/sentinel'); setIsHeaderMenuOpen(false); }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-indigo-900/40' : 'bg-indigo-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <FaShieldAlt size={14} className="text-indigo-600" />
                                                        </div>
                                                        <span className="font-medium">Sentinel Dashboard</span>
                                                    </button>
                                                </li>
                                            )}

                                            {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) && (
                                                <li className={`border-t ${isDarkMode ? 'border-gray-600/50' : 'border-gray-200/50'} my-2`}></li>
                                            )}

                                            {/* Theme & Settings */}
                                            <li>
                                                <button
                                                    onClick={() => { handleOpenSettings(); }}
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

                                            {/* Reminders - Only for logged-in users */}
                                            {currentUser && (
                                                <li>
                                                    <button
                                                        onClick={() => { setShowReminders(true); setIsHeaderMenuOpen(false); }}
                                                        className={`w-full text-left px-4 py-3 ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80'} flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] group`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'} group-hover:scale-110 transition-transform duration-200`}>
                                                            <FaClock size={14} className="text-indigo-500" />
                                                        </div>
                                                        <span className="font-medium">Reminders</span>
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
                                                        onClick={async () => {
                                                            setIsHeaderMenuOpen(false);
                                                            if (!currentUser) {
                                                                setAuthModal({ isOpen: true, type: 'save' });
                                                                return;
                                                            }
                                                            try {
                                                                // Fetch the FULL chat history from backend, not just locally loaded messages
                                                                const currentSessionId = getOrCreateSessionId();
                                                                let allMessages = messages; // fallback to local
                                                                if (currentSessionId && currentUser) {
                                                                    try {
                                                                        toast.info('Preparing full chat for download...');
                                                                        const resp = await authenticatedFetch(`${API_BASE_URL}/api/chat-history/session/${currentSessionId}?page=1&limit=10000`);
                                                                        if (resp.ok) {
                                                                            const data = await resp.json();
                                                                            if (data.success && data.data.messages && data.data.messages.length > 0) {
                                                                                allMessages = data.data.messages;
                                                                                console.log(`Save Chat: fetched ${allMessages.length} messages from backend (local had ${messages.length})`);
                                                                            }
                                                                        }
                                                                    } catch (fetchErr) {
                                                                        console.warn('Could not fetch full history, saving locally loaded messages:', fetchErr);
                                                                    }
                                                                }
                                                                // Filter out the welcome message from the export
                                                                const welcomePrefix = "Hello! I'm SetuAI";
                                                                const exportMessages = allMessages.filter(m =>
                                                                    !(m.role === 'assistant' && m.content && m.content.startsWith(welcomePrefix))
                                                                );
                                                                const lines = exportMessages.map(m => {
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
                                                                toast.success('Chat saved successfully!');
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
                                                            // Force a quick save of current messages before opening share modal
                                                            // to ensure backend has the total chat even if not all loaded
                                                            if (currentUser && messages.length > 0) {
                                                                saveCurrentSession();
                                                            }
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
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            {isDraggingOver && (
                                <div className="absolute inset-0 bg-transparent backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white animate-fadeIn pointer-events-none">
                                    <div className="relative flex items-center justify-center w-40 h-40 mb-6">
                                        {/* File Card Group Container with optional opacity/blur */}
                                        <div className={`relative flex items-center justify-center w-40 h-40 transition-all duration-300 ${!currentUser ? 'opacity-40 blur-[1px]' : ''}`}>
                                            {/* Terminal/Code Icon (Left) */}
                                            <div className="absolute w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-xl shadow-lg flex items-center justify-center transform -rotate-12 -translate-x-12 translate-y-2 border border-white/20">
                                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            {/* Document Icon (Center/Back) */}
                                            <div className="absolute w-16 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-xl flex flex-col justify-between p-3 transform -translate-y-4 border border-white/20">
                                                <div className="w-6 h-1.5 bg-white/40 rounded"></div>
                                                <div className="space-y-1.5 flex-1 mt-3">
                                                    <div className="w-full h-1 bg-white/70 rounded"></div>
                                                    <div className="w-full h-1 bg-white/70 rounded"></div>
                                                    <div className="w-3/4 h-1 bg-white/70 rounded"></div>
                                                </div>
                                            </div>
                                            {/* Image Icon (Right/Front) */}
                                            <div className="absolute w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-2xl flex items-center justify-center transform rotate-12 translate-x-12 translate-y-2 border border-white/20">
                                                <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        </div>
                                        {/* Floating Lock Icon overlay for public view */}
                                        {!currentUser && (
                                            <div className="absolute w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/30 transform scale-110 animate-pulse z-10">
                                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">
                                        {currentUser ? 'Add anything' : 'Login Required'}
                                    </h3>
                                    <p className="text-gray-300 text-sm max-w-xs text-center px-4">
                                        {currentUser 
                                            ? 'Drop any file here to add it to the conversation' 
                                            : 'Please log in to upload files and use attachments with SetuAI'}
                                    </p>
                                </div>
                            )}
                            <div
                                ref={messagesContainerRef}
                                className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 relative"
                                role="log"
                                aria-live={screenReaderSupport ? "polite" : "off"}
                                aria-label="Chat messages"
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                            {/* Floating Date Indicator (sticky below header) */}
                            {messages.length > 0 && floatingDateLabel && (
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

                            {/* Loading Previous Messages Spinner */}
                            {isLoadingPreviousMessages && (
                                <div className="flex justify-center py-4 animate-fadeIn">
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg ${isDarkMode ? 'bg-gray-800/90 border-gray-700 text-blue-400' : 'bg-white/90 border-blue-100 text-blue-600'} backdrop-blur-md transform transition-all hover:scale-105`}>
                                        <UrbanSetuSpinner size="sm" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading History</span>
                                    </div>
                                </div>
                            )}

                            {/* Empty Chat State Suggestions */}
                            {messages.length === 0 && !isLoading && !isLoadingPreviousMessages && !isLoadingSessionHistory && (
                                <div className="flex flex-col items-center justify-center min-h-[85%] my-auto py-8 px-2 sm:px-4 select-none animate-fadeIn w-full max-w-3xl mx-auto">
                                    {/* Logo & Greeting */}
                                    <div className="flex flex-col items-center mb-6">
                                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20 mb-4 transform transition-all hover:scale-110 duration-300">
                                            <FaRobot className="text-white text-3xl" />
                                        </div>
                                        <h2 className={`text-xl sm:text-2xl font-extrabold text-center bg-clip-text text-transparent ${
                                            isDarkMode 
                                                ? 'bg-gradient-to-r from-gray-100 via-gray-300 to-gray-400' 
                                                : `bg-gradient-to-r ${themeColors.primary}`
                                        } tracking-tight px-4 leading-normal`}>
                                            {currentGreeting || "How can I help you today?"}
                                        </h2>
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mt-2 px-6">
                                            Ask SetuAI about property searches, loan processes, scheduling visits, or general questions.
                                        </p>
                                    </div>

                                    {/* Suggestions Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-2">
                                        {currentSuggestions.map((card, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSmartSuggestion(card.prompt)}
                                                className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-95 ${
                                                    isDarkMode
                                                        ? 'bg-gray-800/40 border-gray-700/60 hover:bg-gray-800/80 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                                        : `bg-white/60 border-gray-200/80 hover:bg-white hover:${themeColors.border} hover:shadow-[0_8px_20px_rgba(59,130,246,0.06)]`
                                                }`}
                                            >
                                                <span className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 text-lg ${
                                                    isDarkMode 
                                                        ? 'bg-gray-700/60 text-gray-300' 
                                                        : `${themeColors.secondary} ${themeColors.accent}`
                                                }`}>
                                                    {card.icon}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                                        {card.label}
                                                    </h3>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                                                        {card.description}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
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
                                                {(message.imageUrl || (message.images && message.images.length > 0) || (editingMessageIndex === index && editingMessageImages.length > 0)) && (
                                                    <div className="mb-2 flex flex-wrap gap-2">
                                                        {(editingMessageIndex === index ? editingMessageImages : (message.images && message.images.length > 0 ? message.images : [message.imageUrl])).filter(Boolean).map((img, imgIdx) => (
                                                            <div key={imgIdx} className="relative group w-32 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:scale-[1.02]">
                                                                <img
                                                                    src={img}
                                                                    alt={`Shared image ${imgIdx + 1}`}
                                                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPreviewImages(editingMessageIndex === index ? editingMessageImages : (message.images && message.images.length > 0 ? message.images : [message.imageUrl]));
                                                                        setPreviewImageIndex(imgIdx);
                                                                        setIsImagePreviewOpen(true);
                                                                    }}
                                                                    onError={(e) => {
                                                                        e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                                                        e.target.className = "w-full h-full object-cover opacity-50";
                                                                    }}
                                                                />
                                                                {editingMessageIndex === index ? (
                                                                    <button
                                                                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 z-10"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingMessageImages(prev => prev.filter((_, i) => i !== imgIdx));
                                                                        }}
                                                                        title="Remove image"
                                                                    >
                                                                        <FaTimes size={12} />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        className="absolute top-1 right-1 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 p-1 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hidden sm:block"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            try {
                                                                                const response = await fetch(img, { mode: 'cors' });
                                                                                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                                                const blob = await response.blob();
                                                                                const blobUrl = window.URL.createObjectURL(blob);
                                                                                const a = document.createElement('a');
                                                                                a.href = blobUrl;
                                                                                a.download = `image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
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
                                                                )}

                                                                {/* Face Recognition Tag Overlay for Sent Images */}
                                                                {img && editingMessageIndex !== index && (
                                                                    (() => {
                                                                        let faceName = '';
                                                                        let faceDetails = '';
                                                                        if (message.faceTags && message.faceTags.length > 0) {
                                                                            faceName = message.faceTags[0].name;
                                                                            faceDetails = message.faceTags[0].details || '';
                                                                        } else {
                                                                            const faces = parseFacesFromOcr(message.ocrText, img);
                                                                            faceName = faces[0] || '';
                                                                            const knownFaces = getKnownFaces();
                                                                            const matched = knownFaces.find(kf => kf.name === faceName);
                                                                            if (matched) faceDetails = matched.details || '';
                                                                        }
                                                                        const hasFace = faceName || hasUnknownFace(message.ocrText, img);
                                                                        
                                                                        if (taggingSentImageLoading[img]) {
                                                                            return (
                                                                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1 z-20">
                                                                                    <span className="text-[8px] text-purple-400 font-bold animate-pulse">Running Face AI...</span>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        
                                                                        if (faceName) {
                                                                            return (
                                                                                <div 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleSentImageTagClick(img, faceName, faceDetails);
                                                                                    }}
                                                                                    className="absolute bottom-0 inset-x-0 bg-black/75 hover:bg-black/90 text-white py-0.5 px-1 truncate flex items-center justify-center gap-1 z-15 select-none cursor-pointer transition-colors duration-200"
                                                                                    title={`Face identified: ${faceName}. Click to modify tag.`}
                                                                                >
                                                                                    <FaUser size={6} className="text-purple-400" />
                                                                                    <span className="text-[7.5px] font-bold tracking-tight truncate">
                                                                                        {faceName}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        } else if (hasFace) {
                                                                            return (
                                                                                <div 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleSentImageTagClick(img, '');
                                                                                    }}
                                                                                    className="absolute bottom-0 inset-x-0 bg-black/75 hover:bg-black/90 text-white py-0.5 px-1 truncate flex items-center justify-center gap-1 z-15 select-none cursor-pointer transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                                                                                    title="Click to tag this face"
                                                                                >
                                                                                    <FaUser size={6} className="text-purple-400 animate-pulse" />
                                                                                    <span className="text-[7.5px] font-bold tracking-tight truncate">
                                                                                        Tag Face
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()
                                                                )}
                                                            </div>
                                                        ))}
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
                                                                    controlsList="nodownload"
                                                                    preload="metadata"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
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
                                                                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 p-1 rounded-full shadow-md transition-colors hidden sm:block"
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
                                                        <div 
                                                            className={`flex items-center rounded-lg border transition-all duration-200 ${
                                                                message.role === 'user'
                                                                    ? 'border-white/20 bg-white/10 text-white'
                                                                    : isDarkMode
                                                                        ? 'border-gray-700 bg-gray-900/40 text-gray-200'
                                                                        : 'border-gray-200 bg-white text-gray-800'
                                                            }`}
                                                        >
                                                            {/* Clickable Area for Preview */}
                                                            <div
                                                                className={`flex items-center gap-2 px-3 py-2 flex-grow cursor-pointer transition-colors rounded-l-lg select-none min-w-0 ${
                                                                    message.role === 'user'
                                                                        ? 'hover:bg-white/10'
                                                                        : isDarkMode
                                                                            ? 'hover:bg-gray-800/80'
                                                                            : 'hover:bg-gray-50'
                                                                }`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const cleanUrl = message.documentUrl.split('?')[0];
                                                                    const ext = cleanUrl.split('.').pop().toLowerCase();
                                                                    let type = 'document';
                                                                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
                                                                    else if (ext === 'pdf') type = 'pdf';

                                                                    const pathPrefix = currentUser ? (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin' : '/user') : '';
                                                                    const previewUrl = `${pathPrefix}/view/preview?url=${encodeURIComponent(message.documentUrl)}&name=${encodeURIComponent(message.documentName || 'Document')}&type=${type}&source=gemini_chatbox`;
                                                                    window.open(previewUrl, '_blank');
                                                                }}
                                                                title="Click to view document"
                                                            >
                                                                <div className={`p-1.5 rounded flex-shrink-0 ${
                                                                    message.role === 'user'
                                                                        ? 'bg-white/20 text-white'
                                                                        : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                                                }`}>
                                                                    <FaFileAlt size={14} />
                                                                </div>
                                                                <span className="text-sm font-medium truncate max-w-[180px] sm:max-w-[240px]">
                                                                    {message.documentName || 'Document'}
                                                                </span>
                                                            </div>

                                                            {/* Separator */}
                                                            <div className={`w-[1px] self-stretch flex-shrink-0 ${
                                                                message.role === 'user' ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
                                                            }`} />

                                                            {/* Download Button */}
                                                            <button
                                                                className={`p-2.5 flex items-center justify-center flex-shrink-0 transition-colors rounded-r-lg ${
                                                                    message.role === 'user'
                                                                        ? 'text-white/80 hover:text-white hover:bg-white/10'
                                                                        : isDarkMode
                                                                            ? 'text-gray-400 hover:text-white hover:bg-gray-800/80'
                                                                            : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                                                }`}
                                                                title="Download Document"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        console.log('Starting download for URL:', message.documentUrl);

                                                                        const isCloudinary = message.documentUrl.includes('cloudinary.com');
                                                                        const response = isCloudinary
                                                                            ? await fetch(message.documentUrl, { mode: 'cors' })
                                                                            : await authenticatedFetch(message.documentUrl, { mode: 'cors' });

                                                                        if (!response.ok) throw new Error(`HTTP ${response.status}`);

                                                                        const blob = await response.blob();
                                                                        const blobUrl = window.URL.createObjectURL(blob);
                                                                        const a = document.createElement('a');
                                                                        a.href = blobUrl;
                                                                        a.download = message.documentName || `document-${Date.now()}`;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        a.remove();
                                                                        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                                                        toast.success('Document downloaded successfully');
                                                                    } catch (error) {
                                                                        console.error('Download failed:', error);
                                                                        // Fallback to direct link
                                                                        const a = document.createElement('a');
                                                                        a.href = message.documentUrl;
                                                                        a.download = message.documentName || `document-${Date.now()}`;
                                                                        a.target = '_blank';
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        a.remove();
                                                                        toast.success('Document download started');
                                                                    }
                                                                }}
                                                            >
                                                                <FaDownload className="text-xs" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Version Selection UI (Arrows) */}
                                                {editingMessageIndex === null && message.variants && message.variants.length > 1 && (
                                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tighter ${message.role === 'user' ? 'bg-white/10 text-white/90' : 'bg-gray-200 text-gray-600'} mb-2 w-fit border ${message.role === 'user' ? 'border-white/20' : 'border-gray-300'} select-none`}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); switchMessageVersion(index, (message.activeVersionIndex || 0) - 1); }}
                                                            disabled={(message.activeVersionIndex || 0) === 0}
                                                            className="hover:scale-125 disabled:opacity-30 transition-all p-0.5"
                                                            title="Previous version"
                                                        >
                                                            <FaChevronLeft size={7} />
                                                        </button>
                                                        <div className="flex items-center gap-0.5 min-w-[24px] justify-center">
                                                            <span className="opacity-90">{(message.activeVersionIndex || 0) + 1}</span>
                                                            <span className="opacity-50">/</span>
                                                            <span className="opacity-90">{message.variants.length}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); switchMessageVersion(index, (message.activeVersionIndex || 0) + 1); }}
                                                            disabled={(message.activeVersionIndex || 0) === message.variants.length - 1}
                                                            className="hover:scale-125 disabled:opacity-30 transition-all p-0.5"
                                                            title="Next version"
                                                        >
                                                            <FaChevronRight size={7} />
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
                                                                className={`w-full max-w-full box-border md:min-w-[300px] p-3 text-sm rounded-xl resize-none focus:outline-none focus:ring-2 ${themeColors.accent.replace('text-', 'focus:ring-').replace('-600', '-500')} shadow-inner ${editingMessageContent.length > 1800 ? 'pr-20' : ''} ${isDarkMode
                                                                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                                                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                                    }`}
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
                                                                    {(propertySuggestions.length > 0 || blogSuggestions.length > 0) ? [...propertySuggestions, ...blogSuggestions].map((item, idx) => {
                                                                        const isBlog = item.type === 'blog' || item.type === 'guide';

                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                key={item.id || item._id || idx}
                                                                                onMouseDown={(e) => { e.preventDefault(); handleEditSuggestionSelect(item); }}
                                                                                className={`w-full text-left p-2 text-xs border-b ${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-100'} ${idx === selectedEditSuggestionIndex ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-100') : ''}`}
                                                                            >
                                                                                <div className={`font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
                                                                                    {isBlog ? <FaFileAlt className="text-blue-500 flex-shrink-0" size={10} /> : <FaHome className="text-green-500 flex-shrink-0" size={10} />}
                                                                                    {item.name || item.title}
                                                                                </div>
                                                                                {isBlog ? (
                                                                                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>Category: {item.category || 'General'}</div>
                                                                                ) : (
                                                                                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>{item.location} • ₹{item.price?.toLocaleString()}</div>
                                                                                )}
                                                                            </button>
                                                                        )
                                                                    }) : (
                                                                        <div className="p-2 text-xs text-center text-gray-500">No results found</div>
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
                                                            <div className="message-content-text">
                                                                {renderTextWithMarkdownAndLinks(message.content, message.role === 'user', message)}
                                                            </div>
                                                            
                                                            {/* Confirmation bubble if cancellation requires confirmation */}
                                                            {renderConfirmationBubble(message, index)}

                                                            {/* Recommended Properties Slider */}
                                                            {message.role === 'assistant' && message.recommendations && message.recommendations.length > 0 && (
                                                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 animate-fade-in not-prose">
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
                                                                            {message.recommendations.length} {(() => {
                                                                                const hasBlogs = message.recommendations.some(r => r.type === 'blog' || r.type === 'guide');
                                                                                const count = message.recommendations.length;
                                                                                if (hasBlogs) return count === 1 ? 'article' : 'articles';
                                                                                return count === 1 ? 'property' : 'properties';
                                                                            })()}
                                                                        </span>
                                                                    </div>

                                                                    <RecommendationSlider recommendations={message.recommendations} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                )}
                                                {/* Message footer with timestamp and actions */}
                                                <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDarkMode ? 'border-gray-200/20' : 'border-gray-300/60'}`}>
                                                    {message.timestamp && showTimestamps && (
                                                        <div className={`${message.role === 'user' ? 'text-white/80' : message.isError ? (isDarkMode ? 'text-red-400' : 'text-red-700') : 'text-gray-500 dark:text-gray-400'} text-[10px]`}>
                                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}



                                                    {/* Action buttons - hidden when editing */}
                                                    {editingMessageIndex !== index && (
                                                        <div className="flex items-center gap-1.5 transition-all duration-200">
                                                            {/* Token Usage Badge for assistant messages */}
                                                            {message.role === 'assistant' && message.tokenUsage && !message.isError && !message.isRestricted && (
                                                                <div
                                                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium cursor-default animate-fadeIn mr-1"
                                                                    style={{
                                                                        background: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : 'rgba(234, 179, 8, 0.1)',
                                                                        color: isDarkMode ? '#facc15' : '#a16207',
                                                                        border: `1px solid ${isDarkMode ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.2)'}`,
                                                                        animation: 'tokenFadeIn 0.6s ease-out'
                                                                    }}
                                                                    title={`Prompt: ${message.tokenUsage.promptTokens} · Completion: ${message.tokenUsage.completionTokens} · Total: ${message.tokenUsage.totalTokens} tokens`}
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                                                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                                                                        <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">T</text>
                                                                    </svg>
                                                                    <span>{message.tokenUsage.totalTokens}</span>
                                                                </div>
                                                            )}
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
                                                            {message.role === 'user' && !message.isRestricted && !isBlockedByPolicy && (
                                                                <button
                                                                    onClick={() => startEditingMessage(index, message.content, message.images || (message.imageUrl ? [message.imageUrl] : []))}
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
                                                                    onClick={() => shareMessage(message, index)}
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

                                                            {/* Retry buttons - hidden for policy violation and restricted messages */}
                                                            {message.role === 'assistant' && !message.isViolation && !message.isRestricted && (
                                                                <div className="relative retry-menu-container">
                                                                    <button
                                                                        onClick={() => {
                                                                            const previousUserMessage = (() => {
                                                                                for (let i = index - 1; i >= 0; i--) {
                                                                                    if (messages[i]?.role === 'user') return messages[i].content;
                                                                                }
                                                                                return lastUserMessageRef.current;
                                                                            })();
                                                                            if (previousUserMessage) {
                                                                                setActiveRetryMenu(
                                                                                    activeRetryMenu?.index === index
                                                                                        ? null
                                                                                        : { index, previousUserMessage }
                                                                                );
                                                                                setRetryInstruction('');
                                                                            }
                                                                        }}
                                                                        disabled={isLoading || isBlockedByPolicy || (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')}
                                                                        className={`p-1 ${themeColors.accent} hover:opacity-80 hover:${themeColors.secondary} rounded transition-all duration-200 disabled:opacity-50`}
                                                                        title="Change Response"
                                                                        aria-label="Change Response"
                                                                    >
                                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                                                            <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26l1.46-1.46C6.26 13.86 6 12.97 6 12c0-3.31 2.69-6 6-6zm5.76 1.74L16.3 9.2C17.74 10.14 18.5 11.49 18.5 13c0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
                                                                        </svg>
                                                                    </button>

                                                                    {activeRetryMenu?.index === index && (
                                                                        <div 
                                                                            className={`absolute bottom-full right-0 mb-2 w-56 rounded-xl shadow-2xl p-1.5 z-20 border backdrop-blur-md transition-all duration-205 ${
                                                                                isDarkMode 
                                                                                    ? 'bg-gray-900/95 border-gray-700/80 text-gray-100' 
                                                                                    : 'bg-white/95 border-gray-200 text-gray-800'
                                                                            }`}
                                                                        >
                                                                            <div className={`flex flex-col border-b ${isDarkMode ? 'border-gray-800/80' : 'border-gray-100'} mb-1.5 pb-1`}>
                                                                                <div className="flex items-center gap-2 p-1">
                                                                                    <input
                                                                                        autoFocus
                                                                                        type="text"
                                                                                        value={retryInstruction}
                                                                                        onChange={(e) => setRetryInstruction(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter' && retryInstruction.trim()) {
                                                                                                e.preventDefault();
                                                                                                retryMessage(activeRetryMenu.previousUserMessage, index, { changeInstruction: retryInstruction.trim().slice(0, 150) });
                                                                                                setRetryInstruction('');
                                                                                                setActiveRetryMenu(null);
                                                                                            }
                                                                                        }}
                                                                                        maxLength={150}
                                                                                        placeholder="Ask to change response..."
                                                                                        className={`flex-1 text-[11px] px-2.5 py-1 rounded-lg focus:outline-none focus:ring-1 ${
                                                                                            isDarkMode 
                                                                                                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500' 
                                                                                                : 'bg-gray-50 border-gray-250 text-gray-800 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500'
                                                                                        }`}
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            if (retryInstruction.trim()) {
                                                                                                retryMessage(activeRetryMenu.previousUserMessage, index, { changeInstruction: retryInstruction.trim().slice(0, 150) });
                                                                                                setRetryInstruction('');
                                                                                                setActiveRetryMenu(null);
                                                                                            }
                                                                                        }}
                                                                                        disabled={!retryInstruction.trim()}
                                                                                        className={`p-1.5 rounded-full flex items-center justify-center transition-all duration-200 ${
                                                                                            retryInstruction.trim() 
                                                                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95' 
                                                                                                : 'bg-gray-200/50 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-650'
                                                                                        }`}
                                                                                        title="Submit instruction"
                                                                                    >
                                                                                        <FaArrowUp size={8} />
                                                                                    </button>
                                                                                </div>
                                                                                {retryInstruction.length > 100 && (
                                                                                    <div className="text-[9px] text-right px-2 text-orange-500 font-medium">
                                                                                        {retryInstruction.length}/150 chars
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <button
                                                                                onClick={() => {
                                                                                    retryMessage(activeRetryMenu.previousUserMessage, index, {});
                                                                                    setActiveRetryMenu(null);
                                                                                }}
                                                                                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                                                                                    isDarkMode 
                                                                                        ? 'hover:bg-gray-800 text-gray-200' 
                                                                                        : 'hover:bg-gray-100 text-gray-750'
                                                                                }`}
                                                                            >
                                                                                <FaSync size={11} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                                                                <span>Try again</span>
                                                                            </button>
                                                                            
                                                                            <button
                                                                                onClick={() => {
                                                                                    retryMessage(activeRetryMenu.previousUserMessage, index, { thinkLonger: true });
                                                                                    setActiveRetryMenu(null);
                                                                                }}
                                                                                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                                                                                    isDarkMode 
                                                                                        ? 'hover:bg-gray-800 text-gray-200' 
                                                                                        : 'hover:bg-gray-100 text-gray-750'
                                                                                }`}
                                                                            >
                                                                                <FaBrain size={11} className={isDarkMode ? 'text-purple-400' : 'text-purple-500'} />
                                                                                <span>Think longer</span>
                                                                            </button>
                                                                            
                                                                            <button
                                                                                onClick={() => {
                                                                                    retryMessage(activeRetryMenu.previousUserMessage, index, { searchWeb: true });
                                                                                    setActiveRetryMenu(null);
                                                                                }}
                                                                                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                                                                                    isDarkMode 
                                                                                        ? 'hover:bg-gray-800 text-gray-200' 
                                                                                        : 'hover:bg-gray-100 text-gray-750'
                                                                                }`}
                                                                            >
                                                                                <FaGlobe size={11} className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} />
                                                                                <span>Search the web</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
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
                                                <ScrollingThinkingTags isDarkMode={isDarkMode} isScheduler={isCurrentRequestScheduler} schedulerType={currentSchedulerType} isDeepThinking={isCurrentRequestDeepThinking} isWebSearch={isCurrentRequestWebSearch} mediaType={currentRequestMediaType} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                            {/* scroll button moved to container-level absolute positioning */}
                        </div>
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


                            {/* Text Extraction / OCR Progress Bar */}
                            {isExtractingText && (
                                <div className="mb-3 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl animate-pulse">
                                    <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <UrbanSetuSpinner size="sm" />
                                            <span>Analyzing Document & Extracting Content...</span>
                                        </div>
                                        <span className="opacity-90">{extractionProgress}</span>
                                    </div>
                                    <div className="w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full animate-pulse" style={{ width: '100%' }}></div>
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
                                                <div className={`p-1.5 rounded-lg shadow-sm ${isDarkMode
                                                    ? `bg-opacity-20 bg-white border border-white/10`
                                                    : `bg-gradient-to-r ${themeColors.primary} text-white`
                                                    }`}>
                                                    <FaLightbulb size={12} className={isDarkMode ? themeColors.accent : "text-white animate-pulse"} />
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    Smart Suggestions
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={handleLoadMoreSuggestions}
                                                    disabled={isBlockedByPolicy || isLoadingMoreSuggestions || !canLoadMoreSuggestions}
                                                    className={`p-1 rounded-full transition-all duration-200 ${isDarkMode
                                                        ? 'hover:bg-gray-700 text-gray-500'
                                                        : `hover:bg-white text-gray-400 shadow-sm border border-transparent hover:border-blue-100`} hover:text-blue-500 ${isBlockedByPolicy || !canLoadMoreSuggestions ? 'opacity-50 cursor-not-allowed' : ''} flex items-center justify-center`}
                                                    title={isBlockedByPolicy ? "Disabled during cooldown" : !canLoadMoreSuggestions ? "Refresh limit reached. Please wait." : "Load More Suggestions"}
                                                >
                                                    {isLoadingMoreSuggestions ? <UrbanSetuSpinner size="sm" /> : <FaSync size={10} />}
                                                </button>
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
                                        </div>

                                        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                                            {smartSuggestions.map((suggestion, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => !isBlockedByPolicy && handleSmartSuggestion(suggestion)}
                                                    className={`text-[11px] px-3 py-1.5 rounded-xl border transition-all duration-300 ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.03] active:scale-95'} whitespace-nowrap flex-shrink-0 ${isDarkMode
                                                        ? `bg-gray-900/60 border-gray-600 text-gray-300 ${isBlockedByPolicy ? '' : 'hover:bg-gray-800 hover:border-white/20 hover:text-white'}`
                                                        : `bg-white ${themeColors.border} ${themeColors.accent} ${isBlockedByPolicy ? '' : 'hover:bg-gray-50 shadow-sm'}`
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

                            <form onSubmit={handleSubmit} className={`flex space-x-2 items-end relative`}>
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
                                                    <div className={`absolute bottom-10 left-0 w-48 sm:w-64 group/menu rounded-lg shadow-xl border overflow-hidden z-50 transform origin-bottom-left transition-all duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isBlockedByPolicy) {
                                                                    toast.warning('File upload is disabled during your policy cooldown.');
                                                                    return;
                                                                }
                                                                if (!currentUser) {
                                                                    toast.info('Please login to upload files');
                                                                    return;
                                                                }
                                                                setShowFileUpload(true);
                                                                setShowInputOptions(false);
                                                            }}
                                                            disabled={isBlockedByPolicy}
                                                            className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'} ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                                    <FaPaperclip size={14} />
                                                                </div>
                                                                <span className="text-sm font-medium">Upload File</span>
                                                            </div>
                                                            <span className={`hidden sm:inline-block text-[10px] opacity-0 group-hover/menu:opacity-60 font-mono px-1.5 py-0.5 rounded ml-auto whitespace-nowrap transition-opacity duration-300 ${
                                                                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 border border-gray-200 text-gray-500 shadow-sm'
                                                            }`}>Ctrl+U</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isBlockedByPolicy) {
                                                                    toast.warning('Voice input is disabled during your policy cooldown.');
                                                                    return;
                                                                }
                                                                toggleVoiceInput();
                                                                setShowInputOptions(false);
                                                            }}
                                                            disabled={isBlockedByPolicy}
                                                            className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'} ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
                                                                    <FaMicrophone size={14} />
                                                                </div>
                                                                <span className="text-sm font-medium">Voice Input</span>
                                                            </div>
                                                            <span className={`hidden sm:inline-block text-[10px] opacity-0 group-hover/menu:opacity-60 font-mono px-1.5 py-0.5 rounded ml-auto whitespace-nowrap transition-opacity duration-300 ${
                                                                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 border border-gray-200 text-gray-500 shadow-sm'
                                                            }`}>Ctrl+Shift+A</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isBlockedByPolicy) {
                                                                    toast.warning('Image auditing is disabled during your policy cooldown.');
                                                                    return;
                                                                }
                                                                if (!currentUser) {
                                                                    toast.info('Please login to use image link');
                                                                    return;
                                                                }
                                                                setShowImageLinkModal(true);
                                                                setShowInputOptions(false);
                                                            }}
                                                            disabled={isBlockedByPolicy}
                                                            className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'} ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                    <FaImage size={14} />
                                                                </div>
                                                                <span className="text-sm font-medium">Image Link</span>
                                                            </div>
                                                            <span className={`hidden sm:inline-block text-[10px] opacity-0 group-hover/menu:opacity-60 font-mono px-1.5 py-0.5 rounded ml-auto whitespace-nowrap transition-opacity duration-300 ${
                                                                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 border border-gray-200 text-gray-500 shadow-sm'
                                                            }`}>Ctrl+Shift+I</span>
                                                        </button>

                                                        <div className={`border-t my-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (!currentUser) {
                                                                    toast.info('Please Login to use these Premium Features');
                                                                    setShowInputOptions(false);
                                                                    return;
                                                                }
                                                                setPrePromptPreference(prev => prev === 'think' ? null : 'think');
                                                                setShowInputOptions(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                                                                    <FaBrain size={14} />
                                                                </div>
                                                                <span className="text-sm font-medium">Think longer</span>
                                                                {!currentUser && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold ml-1">Premium</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 ml-auto">
                                                                {prePromptPreference === 'think' && (
                                                                    <FaCheck className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} size={12} />
                                                                )}
                                                                <span className={`hidden sm:inline-block text-[10px] opacity-0 group-hover/menu:opacity-60 font-mono px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity duration-300 ${
                                                                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 border border-gray-200 text-gray-500 shadow-sm'
                                                                }`}>Ctrl+Shift+M</span>
                                                            </div>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (!currentUser) {
                                                                    toast.info('Please Login to use these Premium Features');
                                                                    setShowInputOptions(false);
                                                                    return;
                                                                }
                                                                setPrePromptPreference(prev => prev === 'search' ? null : 'search');
                                                                setShowInputOptions(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-600'}`}>
                                                                    <FaGlobe size={14} />
                                                                </div>
                                                                <span className="text-sm font-medium">Search the web</span>
                                                                {!currentUser && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold ml-1">Premium</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 ml-auto">
                                                                {prePromptPreference === 'search' && (
                                                                    <FaCheck className={isDarkMode ? 'text-teal-400' : 'text-teal-650'} size={12} />
                                                                )}
                                                                <span className={`hidden sm:inline-block text-[10px] opacity-0 group-hover/menu:opacity-60 font-mono px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity duration-300 ${
                                                                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 border border-gray-200 text-gray-500 shadow-sm'
                                                                }`}>Ctrl+Shift+S</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative w-full">
                                                {/* Pending Images Preview Area */}
                                                {pendingImages.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 px-4 py-2 mb-1 animate-fadeIn bg-transparent">
                                                        {pendingImages.map((img, index) => (
                                                            <div key={img.id || index} className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-md bg-white/40 dark:bg-gray-800/40 transform transition-all hover:scale-105">
                                                                {img.uploading ? (
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-500/10">
                                                                        <UrbanSetuSpinner size="sm" />
                                                                        <span className="text-[8px] mt-1 font-bold text-gray-500 uppercase tracking-tighter">Uploading</span>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (img.controller) img.controller.abort();
                                                                                setPendingImages(prev => prev.filter(p => p.id !== img.id));
                                                                            }}
                                                                            className="absolute top-1 right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg z-20 transition-all duration-200 hover:scale-110"
                                                                            title="Cancel upload"
                                                                        >
                                                                            <FaTimes size={10} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {img.type === 'image' ? (
                                                                            <img
                                                                                src={img.url}
                                                                                alt={img.name}
                                                                                className={`w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity ${(isAuditing[`chat_${img.id}`] || isOcrExtracting[img.id]) ? 'blur-[1px]' : ''}`}
                                                                                onClick={() => {
                                                                                    setPreviewImages([img.url]);
                                                                                    setPreviewImageIndex(0);
                                                                                    setIsImagePreviewOpen(true);
                                                                                }}
                                                                            />
                                                                        ) : img.type === 'document' ? (
                                                                            <div className={`w-full h-full flex flex-col items-center justify-center bg-indigo-500/10 dark:bg-indigo-500/20 p-1 cursor-pointer ${(isAuditing[`chat_${img.id}`] || isOcrExtracting[img.id]) ? 'blur-[1px]' : ''}`}>
                                                                                <FaFileAlt className="text-indigo-600 dark:text-indigo-400 text-lg sm:text-xl" />
                                                                                <span className="text-[8px] sm:text-[9px] text-gray-700 dark:text-gray-300 text-center truncate w-full mt-1 px-0.5 font-medium" title={img.name}>
                                                                                    {img.name}
                                                                                </span>
                                                                            </div>
                                                                        ) : img.type === 'audio' ? (
                                                                            <div className={`w-full h-full flex flex-col items-center justify-center bg-pink-500/10 dark:bg-pink-500/20 p-1 cursor-pointer ${(isAuditing[`chat_${img.id}`] || isOcrExtracting[img.id]) ? 'blur-[1px]' : ''}`}>
                                                                                <FaMicrophone className="text-pink-600 dark:text-pink-400 text-lg sm:text-xl" />
                                                                                <span className="text-[8px] sm:text-[9px] text-gray-700 dark:text-gray-300 text-center truncate w-full mt-1 px-0.5 font-medium" title={img.name}>
                                                                                    {img.name}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className={`w-full h-full flex flex-col items-center justify-center bg-red-500/10 dark:bg-red-500/20 p-1 cursor-pointer ${(isAuditing[`chat_${img.id}`] || isOcrExtracting[img.id]) ? 'blur-[1px]' : ''}`}>
                                                                                <FaPlay className="text-red-600 dark:text-red-400 text-lg sm:text-xl" />
                                                                                <span className="text-[8px] sm:text-[9px] text-gray-700 dark:text-gray-300 text-center truncate w-full mt-1 px-0.5 font-medium" title={img.name}>
                                                                                    {img.name}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Sentinel Quality Badge */}
                                                                        {(img.type === 'image' && !isAuditing[`chat_${img.id}`] && !isOcrExtracting[img.id]) && auditResults[`chat_${img.id}`] && (
                                                                            <div className="absolute top-1 left-1 flex flex-col gap-0.5 z-10 pointer-events-none">
                                                                                <div className={`px-1 py-0.5 rounded text-[8px] font-bold text-white shadow-sm flex items-center gap-0.5 ${auditResults[`chat_${img.id}`].sentinelScore >= 80 ? 'bg-green-500' :
                                                                                        auditResults[`chat_${img.id}`].sentinelScore >= 50 ? 'bg-orange-500' : 'bg-red-500'
                                                                                    }`}>
                                                                                    <FaShieldAlt size={6} />
                                                                                    {auditResults[`chat_${img.id}`].sentinelScore}
                                                                                </div>
                                                                                {auditResults[`chat_${img.id}`].quality.sharpness === 'Blurry' && (
                                                                                    <div className="px-1 py-0.5 bg-red-600 rounded text-[7px] font-bold text-white shadow-sm animate-pulse uppercase">
                                                                                        Blurry
                                                                                    </div>
                                                                                )}
                                                                                {auditResults[`chat_${img.id}`].privacyRisk && auditResults[`chat_${img.id}`].privacyRisk.risk === 'High' && (
                                                                                    <div className="px-1 py-0.5 bg-yellow-500 rounded text-[7px] font-bold text-black shadow-sm flex items-center gap-0.5 uppercase">
                                                                                        <FaUser size={6} /> Risk
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {(isAuditing[`chat_${img.id}`] || isOcrExtracting[img.id] || isAnalyzingFaces[img.id]) && (
                                                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500/20 backdrop-blur-[1px]">
                                                                                <UrbanSetuSpinner size="sm" isBright={true} />
                                                                                <span className="text-[7px] font-bold text-white uppercase tracking-widest animate-pulse mt-1 text-center px-1">
                                                                                    {isAuditing[`chat_${img.id}`] && isOcrExtracting[img.id] && isAnalyzingFaces[img.id] ? "Auditing, OCR & Face AI..." :
                                                                                     isAnalyzingFaces[img.id] && isOcrExtracting[img.id] ? "OCR & Face AI..." :
                                                                                     isAuditing[`chat_${img.id}`] && isAnalyzingFaces[img.id] ? "Auditing & Face AI..." :
                                                                                     isAnalyzingFaces[img.id] ? "Face AI Analysis..." :
                                                                                     isAuditing[`chat_${img.id}`] && isOcrExtracting[img.id] ? "Auditing & OCR..." :
                                                                                     isAuditing[`chat_${img.id}`] ? "Sentinel Auditing" :
                                                                                     img.type === 'audio' ? "Transcribing..." :
                                                                                     img.type === 'video' ? "Transcribing..." : "Parsing Text..."}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {/* Client-side Face Recognition Tag Overlay */}
                                                                        {img.type === 'image' && !isAuditing[`chat_${img.id}`] && !isOcrExtracting[img.id] && !isAnalyzingFaces[img.id] && detectedFaces[img.id] && detectedFaces[img.id].length > 0 && (
                                                                            <div 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const firstFace = detectedFaces[img.id][0];
                                                                                    setFaceTaggingModal({
                                                                                        isOpen: true,
                                                                                        imgId: img.id,
                                                                                        faceIndex: 0,
                                                                                        descriptor: firstFace.descriptor,
                                                                                        name: firstFace.name !== 'Unknown' ? firstFace.name : '',
                                                                                        details: firstFace.details || ''
                                                                                    });
                                                                                }}
                                                                                className="absolute bottom-0 inset-x-0 bg-black/75 hover:bg-black/90 text-white py-0.5 px-1 truncate flex items-center justify-center gap-1 z-15 select-none cursor-pointer transition-colors duration-200"
                                                                                title={detectedFaces[img.id][0].name === 'Unknown' ? "Click to tag this face" : `Face identified: ${detectedFaces[img.id][0].name}`}
                                                                            >
                                                                                <FaUser size={6} className="text-purple-400 animate-pulse" />
                                                                                <span className="text-[7.5px] font-bold tracking-tight truncate">
                                                                                    {detectedFaces[img.id][0].name === 'Unknown' ? 'Tag Face' : detectedFaces[img.id][0].name}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        <button
                                                                            onClick={() => setPendingImages(prev => prev.filter(p => p.id !== img.id))}
                                                                            className="absolute top-1 right-1 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all duration-200 border border-white/20 shadow-md z-20"
                                                                            title={`Remove ${img.type}`}
                                                                        >
                                                                            <FaTimes size={10} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Pre-prompt Preference Pill */}
                                                {prePromptPreference && (
                                                    <div className="flex px-4 py-1.5 mb-1 animate-fadeIn bg-transparent">
                                                        <div className={`group flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-md border transition-all duration-300 cursor-default ${
                                                            prePromptPreference === 'think'
                                                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 dark:bg-purple-500/20 dark:text-purple-300 shadow-purple-500/5'
                                                                : 'bg-teal-500/10 border-teal-500/30 text-teal-400 dark:bg-teal-500/20 dark:text-teal-300 shadow-teal-500/5'
                                                        }`}>
                                                            {prePromptPreference === 'think' ? (
                                                                <>
                                                                    <FaBrain className="text-purple-500 animate-pulse" size={12} />
                                                                    <span>Think longer</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <FaGlobe className="text-teal-500 animate-pulse" size={12} />
                                                                    <span>Search the web</span>
                                                                </>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setPrePromptPreference(null)}
                                                                className="ml-1 p-0.5 rounded-full hover:bg-black/20 dark:hover:bg-white/20 text-current transition-opacity duration-200 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                                                                title="Remove preference"
                                                            >
                                                                <FaTimes size={10} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                <textarea
                                                    ref={inputRef}
                                                    value={inputMessage}
                                                    onChange={(e) => {
                                                        handleInputChange(e);
                                                    }}
                                                    onPaste={handlePaste}
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

                                                        // Tab key autofills typewriter placeholder tag
                                                        if (e.key === 'Tab' && !inputMessage && !isBlockedByPolicy && !(rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')) {
                                                            e.preventDefault();
                                                            const words = [
                                                                "Ask anything...",
                                                                "Schedule tasks...",
                                                                "Add reminders...",
                                                                "Find homes...",
                                                                "Check rental...",
                                                                "Compare loans...",
                                                                "Ask legal help...",
                                                                "Ask ESG index...",
                                                                "Chat with SetuAI..."
                                                            ];
                                                            const currentWord = words[placeholderIndex];
                                                            const cleanWord = currentWord.replace(/\.\.\.$/, '');
                                                            setInputMessage(cleanWord + " ");
                                                        }

                                                        handleKeyDown(e);
                                                    }}
                                                    placeholder={isBlockedByPolicy ? `Policy Restricted: ${remainingCooldownText || 'Checking status...'}` : (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin') ? "Sign in to chat..." : placeholderText}
                                                    aria-label="Type your message"
                                                    aria-describedby="input-help"
                                                    role="textbox"
                                                    rows={1}
                                                    className={`w-full pl-12 ${inputMessage.length > 1800 ? 'pr-24' : 'pr-12'} py-3 border rounded-2xl resize-none focus:outline-none focus:ring-2 ${themeColors.accent.replace('text-', 'focus:ring-').replace('-600', '-500')} focus:border-transparent text-sm transition-all duration-200 ${isDarkMode
                                                        ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 backdrop-blur-sm'
                                                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-sm hover:border-gray-300'
                                                        } ${isBlockedByPolicy ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                    style={{ minHeight: '48px', maxHeight: '250px' }}
                                                    disabled={isBlockedByPolicy || (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')}
                                                    onTouchStart={(e) => {
                                                        touchStartXRef.current = e.touches[0].clientX;
                                                        touchStartYRef.current = e.touches[0].clientY;
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        if (inputMessage || isBlockedByPolicy || (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')) return;
                                                        const touchEndX = e.changedTouches[0].clientX;
                                                        const touchEndY = e.changedTouches[0].clientY;
                                                        const diffX = touchEndX - touchStartXRef.current;
                                                        const diffY = touchEndY - touchStartYRef.current;

                                                        // Detect horizontal swipe right: diffX > 60 and vertical movement is minor
                                                        if (diffX > 60 && Math.abs(diffY) < 40) {
                                                            const words = [
                                                                "Ask anything...",
                                                                "Schedule tasks...",
                                                                "Add reminders...",
                                                                "Find homes...",
                                                                "Check rental...",
                                                                "Compare loans...",
                                                                "Ask legal help...",
                                                                "Ask ESG index...",
                                                                "Chat with SetuAI..."
                                                            ];
                                                            const currentWord = words[placeholderIndex];
                                                            const cleanWord = currentWord.replace(/\.\.\.$/, '');
                                                            setInputMessage(cleanWord + " ");
                                                            if (inputRef.current) {
                                                                inputRef.current.focus();
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
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
                                                    {(isLoadingSuggestions || isLoadingBlogSuggestions) ? (
                                                        <UrbanSetuSpinner size="sm" />
                                                    ) : (
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                    )}
                                                    {(isLoadingSuggestions || isLoadingBlogSuggestions) ? 'Searching content...' :
                                                        (propertySuggestions.length > 0 || blogSuggestions.length > 0) ? 'Select content to reference:' : 'No results found'}
                                                </div>
                                            </div>
                                            {(propertySuggestions.length > 0 || blogSuggestions.length > 0) ? [...propertySuggestions, ...blogSuggestions].map((item, index) => {
                                                const isBlog = item.type === 'blog' || item.type === 'guide';

                                                return (
                                                    <button
                                                        type="button"
                                                        key={item.id || item._id}
                                                        onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(item); }}
                                                        className={`w-full text-left p-3 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors ${index === selectedSuggestionIndex ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-100') : ''
                                                            }`}
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            {(item.image || item.thumbnail || (item.imageUrls && item.imageUrls[0])) && (
                                                                <img
                                                                    src={item.image || item.thumbnail || item.imageUrls[0]}
                                                                    alt={item.name || item.title}
                                                                    className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                                                                />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
                                                                    {isBlog ? <FaFileAlt className="text-blue-500 flex-shrink-0" size={10} /> : <FaHome className="text-green-500 flex-shrink-0" size={10} />}
                                                                    {item.name || item.title}
                                                                </div>
                                                                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                    {isBlog ? (item.category || 'General') : item.location}
                                                                </div>
                                                                {!isBlog && (
                                                                    <>
                                                                        <div className={`text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                                                            ₹{item.price?.toLocaleString()}
                                                                        </div>
                                                                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                            {item.bedrooms}BHK • {item.area} sq ft • {item.type}
                                                                        </div>
                                                                    </>
                                                                )}
                                                                {isBlog && (
                                                                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} truncate`}>
                                                                        {item.excerpt || "Article content available"}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            }) : (
                                                <div className={`p-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
                                                    No results found. Try typing more characters.
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
                                        disabled={isBlockedByPolicy || (!inputMessage.trim() && pendingImages.length === 0) || inputMessage.length > 2000 || isListening || isProcessingVoice || (rateLimitInfo.remaining <= 0 && rateLimitInfo.role !== 'rootadmin')}
                                        className={`bg-gradient-to-r ${themeColors.primary} text-white p-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 flex-shrink-0 flex items-center justify-center w-12 h-12 group hover:shadow-2xl active:scale-95 shadow-lg border-b-4 border-black/10`}
                                        aria-label="Send message"
                                        title={isBlockedByPolicy ? "Blocked" : "Send message"}
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
                            <div className={`text-[10.5px] text-center mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} select-none`}>
                                SetuAI can make mistakes. Check important info.
                            </div>
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
                                            { icon: '🔧', text: 'Property Management', prompt: 'Help with property management tips' },
                                            { icon: '⏰', text: 'Set Reminder', prompt: 'Schedule a reminder for my property visit tomorrow at 10 AM' },
                                            { icon: '🔔', text: 'Follow-up Alarm', prompt: 'Set an alarm to follow up with the listing agent on Friday at 5 PM' }
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
                                                <UrbanSetuSpinner size="sm" />
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
                                                                toggleBookmark(bookmark.messageIndex, bookmark);
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

                        {/* Reminders Modal */}
                        {showReminders && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-5 w-96 max-w-full max-h-[80vh] overflow-y-auto animate-scaleIn flex flex-col`}>
                                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                                        <h4 className={`font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-905'}`}>
                                            <FaClock className="text-indigo-500" />
                                            Active Reminders
                                            <button
                                                type="button"
                                                onClick={() => setShowReminderInfoModal(true)}
                                                className="text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer focus:outline-none flex items-center"
                                                title="Learn more about reminders"
                                            >
                                                <FaInfoCircle size={14} />
                                            </button>
                                        </h4>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => {
                                                    setIsCreatingReminder(!isCreatingReminder);
                                                    setNewReminderText('');
                                                    setNewReminderDate('');
                                                }}
                                                className={`p-1.5 rounded-lg transition-all duration-205 ${isCreatingReminder
                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                    : isDarkMode
                                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                                    }`}
                                                title="Schedule a reminder manually"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                </svg>
                                            </button>
                                            <button
                                                onClick={fetchReminders}
                                                disabled={isLoadingReminders}
                                                className={`p-1.5 rounded-lg transition-all duration-200 ${isLoadingReminders
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : isDarkMode
                                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                                    }`}
                                                title="Refresh reminders"
                                            >
                                                <FaSync size={12} className={isLoadingReminders ? "animate-spin" : ""} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-1">
                                        {isCreatingReminder && (
                                            <div className={`p-3.5 mb-4 border ${isDarkMode ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-indigo-100 bg-indigo-50/40'} rounded-xl space-y-3`}>
                                                <h5 className={`text-[10px] font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} uppercase tracking-wider`}>New Reminder</h5>
                                                
                                                <div className="space-y-1">
                                                    <label className={`text-[10px] font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>What should we remind you of?</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Call listing agent, Study physics..."
                                                        value={newReminderText}
                                                        onChange={(e) => setNewReminderText(e.target.value)}
                                                        disabled={isSchedulingReminder}
                                                        className={`w-full p-2 border rounded text-xs ${isDarkMode ? 'bg-gray-700 text-white border-gray-600 focus:ring-indigo-500' : 'bg-white text-gray-905 border-gray-300 focus:ring-indigo-500'} ${isSchedulingReminder ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className={`text-[10px] font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>When?</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={newReminderDate}
                                                        onChange={(e) => setNewReminderDate(e.target.value)}
                                                        min={getMinDateTime()}
                                                        disabled={isSchedulingReminder}
                                                        style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                                                        className={`w-full p-2 border rounded text-xs ${isDarkMode ? 'bg-gray-700 text-white border-gray-600 focus:ring-indigo-500' : 'bg-white text-gray-905 border-gray-300 focus:ring-indigo-500'} ${isSchedulingReminder ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>

                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        onClick={() => handleCreateReminder(newReminderText, newReminderDate)}
                                                        disabled={isSchedulingReminder}
                                                        className={`flex-1 text-xs py-2 px-3 rounded-lg bg-indigo-600 text-white font-bold transition-all shadow-md shadow-indigo-600/10 text-center ${isSchedulingReminder ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700 hover:shadow-indigo-600/20'}`}
                                                    >
                                                        {isSchedulingReminder ? 'Scheduling...' : 'Schedule'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsCreatingReminder(false);
                                                            setNewReminderText('');
                                                            setNewReminderDate('');
                                                        }}
                                                        disabled={isSchedulingReminder}
                                                        className={`text-xs py-2 px-3 rounded-lg border font-semibold transition-colors ${isSchedulingReminder ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'}`}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {isLoadingReminders ? (
                                            <div className="flex flex-col items-center justify-center py-12 gap-3 animate-pulse">
                                                <UrbanSetuSpinner />
                                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} font-medium`}>
                                                    Fetching active reminders...
                                                </p>
                                            </div>
                                        ) : reminders.length === 0 ? (
                                            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-center py-8`}>No reminders found</p>
                                        ) : (() => {
                                            const activeReminders = reminders
                                                .filter(r => r.status === 'scheduled' || r.status === 'snoozed' || r.status === 'triggered')
                                                .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
                                            const pastReminders = reminders.filter(r => r.status !== 'scheduled' && r.status !== 'snoozed' && r.status !== 'triggered');
                                            
                                            const activeTotalPages = Math.ceil(activeReminders.length / 3) || 1;
                                            const currentActivePage = Math.min(activePage, activeTotalPages);
                                            const activePageItems = activeReminders.slice((currentActivePage - 1) * 3, currentActivePage * 3);

                                            const pastTotalPages = Math.ceil(pastReminders.length / 3) || 1;
                                            const currentPastPage = Math.min(pastPage, pastTotalPages);
                                            const pastPageItems = pastReminders.slice((currentPastPage - 1) * 3, currentPastPage * 3);

                                            return (
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <h5 className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Active Reminders</h5>
                                                        {activeReminders.length > 0 ? (
                                                            <>
                                                                {/* Next nearest alarm banner */}
                                                                {(() => {
                                                                    const nextReminder = activeReminders.find(r => new Date(r.scheduledTime) > new Date());
                                                                    if (!nextReminder) return null;
                                                                    return (
                                                                        <div className={`mb-4 p-4 rounded-2xl text-center border transition-all duration-300 ${
                                                                            isDarkMode 
                                                                                ? 'bg-gradient-to-b from-indigo-950/20 to-purple-950/10 border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.06)]' 
                                                                                : 'bg-gradient-to-b from-indigo-50/70 to-purple-50/30 border-indigo-100 shadow-sm'
                                                                        }`}>
                                                                            <h2 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                                                {getDurationRemainingText(nextReminder.scheduledTime)}
                                                                            </h2>
                                                                            <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                                                                {formatAlarmDate(nextReminder.scheduledTime)}
                                                                            </p>
                                                                            <p className={`text-[10px] font-medium mt-0.5 italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                                "{nextReminder.taskText}"
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                <div className="space-y-3">
                                                                    {activePageItems.map((reminder, idx) => (
                                                                        <div 
                                                                            key={`${reminder._id}_active_page_${currentActivePage}_${idx}`} 
                                                                            className={`p-3 border ${isDarkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'} rounded-lg transition-all duration-200 hover:shadow-md animate-reminder-item`}
                                                                            style={{ animationDelay: `${idx * 0.03}s` }}
                                                                        >
                                                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                                                <div className={`text-sm font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} flex-1`}>
                                                                                    {reminder.taskText}
                                                                                    {reminder.status === 'snoozed' && (
                                                                                        <span className="ml-2 inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">Snoozed</span>
                                                                                    )}
                                                                                </div>
                                                                                {ringingReminderId === reminder._id && (
                                                                                    <FaBell className="text-red-500 animate-ring-bell flex-shrink-0 mt-0.5" size={14} title="Ringing" />
                                                                                )}
                                                                            </div>
                                                                            <div className={`text-xs flex items-center gap-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-3`}>
                                                                                <FaCalendarAlt size={12} className="text-indigo-400" />
                                                                                {new Date(reminder.scheduledTime).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).replace(',', '')}
                                                                            </div>
                                                                            {isRescheduling && isRescheduling._id === reminder._id ? (
                                                                                <div className="space-y-2 pt-1 border-t border-dashed border-gray-700">
                                                                                    <div className="space-y-1">
                                                                                        <label className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Description</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={rescheduleText}
                                                                                            onChange={(e) => setRescheduleText(e.target.value)}
                                                                                            placeholder="Task description..."
                                                                                            className={`w-full p-2 border rounded text-xs ${isDarkMode ? 'bg-gray-700 text-white border-gray-600 focus:ring-indigo-500' : 'bg-white text-gray-900 border-gray-300 focus:ring-indigo-500'}`}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="space-y-1">
                                                                                        <label className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>New Alert Time</label>
                                                                                        <input
                                                                                            type="datetime-local"
                                                                                            value={rescheduleDate}
                                                                                            onChange={(e) => setRescheduleDate(e.target.value)}
                                                                                            min={getMinDateTime()}
                                                                                            style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                                                                                            className={`w-full p-2 border rounded text-xs ${isDarkMode ? 'bg-gray-700 text-white border-gray-600 focus:ring-indigo-500' : 'bg-white text-gray-900 border-gray-300 focus:ring-indigo-500'}`}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex gap-2">
                                                                                        <button
                                                                                            onClick={() => handleReschedule(reminder._id, rescheduleDate, rescheduleText)}
                                                                                            className="text-xs px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                                                                                        >
                                                                                            Save
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setIsRescheduling(null);
                                                                                                setRescheduleText('');
                                                                                            }}
                                                                                            className={`text-xs px-2.5 py-1.5 rounded font-medium border ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' : 'bg-white hover:bg-gray-150 text-gray-700 border-gray-300'} transition-colors`}
                                                                                        >
                                                                                            Cancel
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ) : ringingReminderId === reminder._id ? (
                                                                                <div className="flex gap-2 border-t pt-2 border-gray-150 dark:border-gray-700/50">
                                                                                    <button
                                                                                        onClick={() => handleSnoozeInline(reminder._id)}
                                                                                        className="text-xs px-2.5 py-1 rounded font-medium transition-colors bg-slate-700 hover:bg-slate-650 text-white"
                                                                                    >
                                                                                        Snooze (5m)
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDismissInline(reminder._id)}
                                                                                        className="text-xs px-2.5 py-1 rounded font-medium transition-colors bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white"
                                                                                    >
                                                                                        Dismiss Reminder
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex gap-2 border-t pt-2 border-gray-150 dark:border-gray-700/50">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setIsRescheduling(reminder);
                                                                                            const date = new Date(reminder.scheduledTime);
                                                                                            const offset = date.getTimezoneOffset();
                                                                                            const localDate = new Date(date.getTime() - (offset * 60 * 1000));
                                                                                            setRescheduleDate(localDate.toISOString().slice(0, 16));
                                                                                            setRescheduleText(reminder.taskText || '');
                                                                                        }}
                                                                                        className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${isDarkMode ? 'bg-indigo-900/30 hover:bg-indigo-800 text-indigo-300' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}
                                                                                    >
                                                                                        Reschedule
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setDeleteReminderId(reminder._id)}
                                                                                        className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${isDarkMode ? 'bg-red-900/30 hover:bg-red-800 text-red-300' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}
                                                                                    >
                                                                                        Cancel
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {activeTotalPages > 1 && (
                                                                    <div className="flex items-center justify-between mt-2 pt-1">
                                                                        <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                            Page {currentActivePage} of {activeTotalPages}
                                                                        </span>
                                                                        <div className="flex gap-1.5">
                                                                            <button
                                                                                onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
                                                                                disabled={currentActivePage === 1}
                                                                                className={`p-1 rounded ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                            >
                                                                                <FaChevronLeft size={10} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setActivePage(prev => Math.min(activeTotalPages, prev + 1))}
                                                                                disabled={currentActivePage === activeTotalPages}
                                                                                className={`p-1 rounded ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                            >
                                                                                <FaChevronRight size={10} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className={`p-4 border border-dashed ${isDarkMode ? 'border-gray-800 bg-gray-900/10 text-gray-500' : 'border-gray-200 bg-gray-50/30 text-gray-400'} rounded-lg text-center`}>
                                                                <p className="text-xs font-medium">No Active Reminders</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {pastReminders.length > 0 && (
                                                        <div className="space-y-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                                            <h5 className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Past & Cancelled reminders</h5>
                                                            <div className="space-y-3">
                                                                {pastPageItems.map((reminder, idx) => (
                                                                    <div 
                                                                        key={`${reminder._id}_past_page_${currentPastPage}_${idx}`} 
                                                                        className={`p-3 border ${isDarkMode ? 'border-gray-750 bg-gray-900/20' : 'border-gray-150 bg-gray-50/50'} rounded-lg opacity-60 hover:opacity-85 transition-all duration-200 animate-reminder-item`}
                                                                        style={{ animationDelay: `${idx * 0.03}s` }}
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                                            <div className={`text-sm font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} ${reminder.status === 'cancelled' ? 'line-through decoration-gray-500/45' : ''}`}>
                                                                                {reminder.taskText}
                                                                            </div>
                                                                            {reminder.status === 'cancelled' ? (
                                                                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-red-100/50 text-red-700 dark:bg-red-950/30 dark:text-red-400 flex-shrink-0">Cancelled</span>
                                                                            ) : (
                                                                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-green-100/50 text-green-700 dark:bg-green-950/30 dark:text-green-400 flex-shrink-0">Sent</span>
                                                                            )}
                                                                        </div>
                                                                        <div className={`text-xs flex items-center gap-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                            <FaCalendarAlt size={12} className="opacity-70" />
                                                                            {new Date(reminder.scheduledTime).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).replace(',', '')}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {pastTotalPages > 1 && (
                                                                <div className="flex items-center justify-between mt-2 pt-1">
                                                                    <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                        Page {currentPastPage} of {pastTotalPages}
                                                                    </span>
                                                                    <div className="flex gap-1.5">
                                                                        <button
                                                                            onClick={() => setPastPage(prev => Math.max(1, prev - 1))}
                                                                            disabled={currentPastPage === 1}
                                                                            className={`p-1 rounded ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                        >
                                                                            <FaChevronLeft size={10} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setPastPage(prev => Math.min(pastTotalPages, prev + 1))}
                                                                            disabled={currentPastPage === pastTotalPages}
                                                                            className={`p-1 rounded ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                        >
                                                                            <FaChevronRight size={10} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex justify-end mt-4 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <button onClick={() => setShowReminders(false)} className={`px-3 py-1.5 text-sm rounded bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90 transition-opacity font-medium`}>Close</button>
                                    </div>
                                </div>

                                {showReminderInfoModal && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] rounded-2xl animate-fadeIn p-4">
                                        <div className={`${isDarkMode ? 'bg-gray-805 bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-850'} rounded-xl border shadow-xl p-4 w-80 max-w-full max-h-[90%] overflow-y-auto flex flex-col animate-scaleIn`}>
                                            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700 mb-3 flex-shrink-0">
                                                <h5 className="font-bold text-xs text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-pink-500 flex items-center gap-1.5">
                                                    <FaInfoCircle className="text-indigo-500" />
                                                    About SetuAI Reminders
                                                </h5>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowReminderInfoModal(false)}
                                                    className={`p-1 rounded-full transition-colors ${
                                                        isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-150 text-gray-500'
                                                    }`}
                                                >
                                                    <FaTimes size={12} />
                                                </button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto space-y-3 text-[11px] leading-relaxed pr-0.5">
                                                <p>
                                                    <strong>SetuAI Task Reminders</strong> is an integrated scheduling assistant designed to keep you on top of all your real-estate actions, appointments, and operations.
                                                </p>
                                                <div>
                                                    <h6 className="font-bold text-indigo-500 mb-0.5">⏰ Real-Time Alerts</h6>
                                                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        Receive on-time push notifications, sound alerts, and email notifications directly to your inbox when a task is due. You can snooze ringing alarms for 5 minutes or dismiss them immediately.
                                                    </p>
                                                </div>
                                                <div>
                                                    <h6 className="font-bold text-indigo-500 mb-0.5">🤖 AI-Driven Commands</h6>
                                                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        You can chat with SetuAI to manage your schedule hands-free. Simply type instructions like:
                                                    </p>
                                                    <ul className="list-disc pl-4 mt-0.5 space-y-0.5 font-medium text-indigo-500">
                                                        <li><em>"Schedule a reminder to check Ocean Breeze apartments tomorrow at 10 am"</em></li>
                                                        <li><em>"Tell me my active reminders"</em></li>
                                                        <li><em>"Reschedule my call with the landlord to 5 pm"</em></li>
                                                        <li><em>"Cancel the listing inspection reminder"</em></li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h6 className="font-bold text-indigo-500 mb-0.5">📈 Scheduling Limits & Rules</h6>
                                                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        To prevent abuse, there is a rate limit of <strong>10 reminders per 24 hours</strong>. Reminders cannot be scheduled in the past.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-705 dark:border-gray-700 flex justify-end flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowReminderInfoModal(false)}
                                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] transition-colors"
                                                >
                                                    Close Info
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Chat History Modal */}
                        {showHistory && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl animate-fadeIn">
                                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl w-96 max-w-full max-h-[80vh] flex flex-col animate-scaleIn relative overflow-hidden`}>
                                    {/* Session Loading Overlay covering the whole modal */}
                                    {isLoadingSessionHistory && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-50 animate-fadeIn">
                                            <UrbanSetuSpinner size="md" />
                                            <p className="text-sm text-white mt-3 font-semibold tracking-wide">Loading chat session...</p>
                                        </div>
                                    )}

                                    {/* Fixed Header */}
                                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                        <h4 className={`font-semibold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                            <FaHistory className="text-blue-500" />
                                            Chat History
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            {chatSessions.length > 0 && (
                                                <button
                                                    onClick={() => setShowDeleteAllModal(true)}
                                                    className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                                >
                                                    Delete All
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (isBlockedByPolicy) {
                                                        toast.warning('Starting a new chat is disabled during your policy cooldown.');
                                                        return;
                                                    }
                                                    createNewSession();
                                                    setShowHistory(false);
                                                }}
                                                disabled={isBlockedByPolicy}
                                                className={`px-3 py-1.5 text-xs rounded bg-green-600 text-white flex items-center gap-1 ${isBlockedByPolicy ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-green-700'}`}
                                            >
                                                <FaComments size={10} />
                                                New Chat
                                            </button>
                                        </div>
                                    </div>

                                    {/* Scrollable Content */}
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {isLoadingSessions ? (
                                            <div className="flex flex-col items-center justify-center py-10 space-y-3 animate-fadeIn">
                                                <UrbanSetuSpinner size="md" />
                                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading chat history...</p>
                                            </div>
                                        ) : chatSessions.length === 0 ? (
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
                                                                    disabled={isLoadingSessionHistory}
                                                                    onClick={() => {
                                                                        const sName = session.name && !/^Chat \d/i.test(session.name) ? session.name : '';
                                                                        setCurrentChatName(sName);
                                                                        loadSessionHistory(session.sessionId, true);
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
                                                                        {session.isPinned && (
                                                                            <FaThumbtack size={10} className="text-indigo-500 dark:text-indigo-400 rotate-45 flex-shrink-0" />
                                                                        )}
                                                                    </div>
                                                                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                        {new Date(session.lastMessageAt).toLocaleString()}
                                                                    </div>
                                                                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} flex items-center justify-between`}>
                                                                        <span>{session.messageCount} messages</span>
                                                                        {session.totalTokens > 0 && (
                                                                            <span className={`flex items-center gap-0.5 ${isDarkMode ? 'text-yellow-500/70' : 'text-yellow-600/80'}`}>
                                                                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                                                                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                                                                                    <text x="12" y="15" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">T</text>
                                                                                </svg>
                                                                                {session.totalTokens.toLocaleString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenHistoryMenuSessionId(prev => prev === session.sessionId ? null : session.sessionId);
                                                                        }}
                                                                        className={`ml-2 p-1.5 ${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-all duration-200 flex items-center justify-center`}
                                                                        title="Chat options"
                                                                        data-chat-options-dropdown
                                                                    >
                                                                        <FaEllipsisH size={14} />
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
                                                                                    await togglePinSession(session.sessionId, session.isPinned);
                                                                                    setOpenHistoryMenuSessionId(null);
                                                                                }}
                                                                                className={`block w-full text-left px-3 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-800 hover:bg-gray-100'}`}
                                                                            >
                                                                                {session.isPinned ? 'Unpin chat' : 'Pin chat'}
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
                                        <div className="flex items-center gap-2">
                                            {selectedHistoryIds.length > 0 && (
                                                <button
                                                    onClick={() => setShowDeleteSelectedModal(true)}
                                                    className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
                                                >
                                                    Delete Selected ({selectedHistoryIds.length})
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {lifetimeUsage && lifetimeUsage.totalTokens > 0 && (
                                                <div
                                                    className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 border ${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}
                                                    title="Total tokens consumed across your entire account history (persists even if chats are deleted)"
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                                                    <span>Σ {lifetimeUsage.totalTokens.toLocaleString()} Lifetime Tokens Used</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => { setShowHistory(false); setOpenHistoryMenuSessionId(null); }}
                                                className={`px-4 py-2 text-sm rounded bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90 transition-all duration-200`}
                                            >
                                                Close
                                            </button>
                                        </div>
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
                                        <button disabled={isDeleting} onClick={() => setShowDeleteAllModal(false)} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'} ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}>Cancel</button>
                                        <button disabled={isDeleting} onClick={async () => {
                                            setIsDeleting(true);
                                            try {
                                                await authenticatedFetch(`${API_BASE_URL}/api/gemini/sessions`, { method: 'DELETE' });
                                                await createNewSession();
                                                await loadChatSessions();
                                                toast.success('All chats deleted');
                                                setShowHistory(false);
                                            } catch (e) {
                                                toast.error('Failed to delete all chats');
                                            } finally {
                                                setIsDeleting(false);
                                                setShowDeleteAllModal(false);
                                            }
                                        }} className={`px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 ${isDeleting ? 'opacity-75 cursor-not-allowed' : ''}`}>
                                            {isDeleting ? 'Deleting...' : 'Delete'}
                                        </button>
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
                                        <button disabled={isDeleting} onClick={() => setShowDeleteSelectedModal(false)} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'} ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}>Cancel</button>
                                        <button disabled={isDeleting} onClick={async () => {
                                            setIsDeleting(true);
                                            try {
                                                for (const id of selectedHistoryIds) { await deleteSession(id); }
                                                setSelectedHistoryIds([]);
                                                await loadChatSessions();
                                                toast.success('Selected chats deleted');
                                            } catch (e) {
                                                toast.error('Failed to delete selected chats');
                                            } finally {
                                                setIsDeleting(false);
                                                setShowDeleteSelectedModal(false);
                                            }
                                        }} className={`px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 ${isDeleting ? 'opacity-75 cursor-not-allowed' : ''}`}>
                                            {isDeleting ? 'Deleting...' : 'Delete'}
                                        </button>
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
                                        <button disabled={isDeleting} onClick={() => setShowDeleteSingleModal(false)} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'} ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}>Cancel</button>
                                        <button disabled={isDeleting} onClick={async () => {
                                            setIsDeleting(true);
                                            try {
                                                if (deleteTargetSessionId) { await deleteSession(deleteTargetSessionId); }
                                                await loadChatSessions();
                                                toast.success('Chat deleted');
                                            } catch (e) {
                                                toast.error('Failed to delete chat');
                                            } finally {
                                                setIsDeleting(false);
                                                setDeleteTargetSessionId(null);
                                                setShowDeleteSingleModal(false);
                                                setOpenHistoryMenuSessionId(null);
                                            }
                                        }} className={`px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 ${isDeleting ? 'opacity-75 cursor-not-allowed' : ''}`}>
                                            {isDeleting ? 'Deleting...' : 'Delete'}
                                        </button>
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
                                        className={`w-full px-3 py-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'} rounded mb-4 ${isRenaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        placeholder="Enter chat name"
                                        maxLength={80}
                                        disabled={isRenaming}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button disabled={isRenaming} onClick={() => { setShowRenameModal(false); setRenameTargetSessionId(null); }} className={`px-3 py-1.5 text-sm rounded border ${isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'} ${isRenaming ? 'opacity-50 cursor-not-allowed' : ''}`}>Cancel</button>
                                        <button disabled={isRenaming} onClick={async () => {
                                            setIsRenaming(true);
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
                                                setIsRenaming(false);
                                                setShowRenameModal(false);
                                                setRenameTargetSessionId(null);
                                                setOpenHistoryMenuSessionId(null);
                                            }
                                        }} className={`px-3 py-1.5 text-sm rounded bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90 ${isRenaming ? 'opacity-75 cursor-not-allowed' : ''}`}>
                                            {isRenaming ? 'Saving...' : 'Save'}
                                        </button>
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
                                        <div className="flex items-center gap-3">
                                            <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                Themes & Settings
                                            </h3>
                                            {currentUser && (
                                                <button
                                                    onClick={() => handleSettingsSync(false)}
                                                    disabled={isSyncingSettings}
                                                    title="Sync with latest preferences"
                                                    className={`p-1.5 rounded-lg transition-all ${isSyncingSettings
                                                        ? 'bg-blue-100 text-blue-600'
                                                        : isDarkMode ? 'bg-gray-800 text-gray-400 hover:text-blue-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                                        }`}
                                                >
                                                    {isSyncingSettings ? <UrbanSetuSpinner size="sm" /> : <FaSync size={14} />}
                                                </button>
                                            )}
                                        </div>
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
                                                        AI Response Settings <span className={`text-xs font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>(per chat)</span>
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
                                                                onChange={(e) => updateTone(e.target.value)}
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
                                                                Data Retention <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>(this chat)</span>
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
                                                                Message Limit <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>(this chat)</span>
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
                                                    <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        Advanced AI Settings
                                                    </h4>
                                                    {/* Info banner + Restore Defaults */}
                                                    <div className={`mb-3 p-2.5 rounded-lg text-xs ${isDarkMode ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'}`}>
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-amber-500 mt-0.5 flex-shrink-0">⚡</span>
                                                            <div className="flex-1">
                                                                <p className={`${isDarkMode ? 'text-amber-300/90' : 'text-amber-700'} leading-relaxed`}>
                                                                    Higher values increase token usage per request. Lower values save tokens while maintaining quality responses.
                                                                </p>
                                                                <button
                                                                    onClick={() => {
                                                                        updateTemperature('0.5');
                                                                        updateTopP('0.7');
                                                                        updateContextWindow('4');
                                                                    }}
                                                                    className={`mt-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5
                                                                        ${isDarkMode
                                                                            ? 'bg-amber-800/40 hover:bg-amber-700/50 text-amber-300 border border-amber-700/40'
                                                                            : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                                                                        }
                                                                        ${temperature === '0.5' && topP === '0.7' && contextWindow === '4'
                                                                            ? 'opacity-50 cursor-default'
                                                                            : 'cursor-pointer hover:scale-[1.02]'
                                                                        }`}
                                                                    disabled={temperature === '0.5' && topP === '0.7' && contextWindow === '4'}
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                    </svg>
                                                                    Restore Optimal Defaults
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
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
                                                                    accentColor: '#2563eb'
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
                                                                    accentColor: '#2563eb'
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
                                                                min="2"
                                                                max="50"
                                                                step="1"
                                                                value={contextWindow}
                                                                onChange={(e) => updateContextWindow(e.target.value)}
                                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                                style={{
                                                                    accentColor: '#2563eb'
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

                                    {/* Modal Footer */}
                                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/30 rounded-b-xl">
                                        <div className="flex flex-col">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 italic font-medium">
                                                {hasSettingsChanged() ? (
                                                    <span className="text-amber-500 flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                                        Unsaved changes pending
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-500 flex items-center gap-1.5">
                                                        <FaCheck size={10} />
                                                        All preferences synced
                                                    </span>
                                                )}
                                            </div>
                                            {currentUser && (
                                                <span className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                                    <FaRobot size={10} />
                                                    Persisted per chat session
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleSettingsClose}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                                    }`}
                                            >
                                                Discard
                                            </button>
                                            <button
                                                onClick={handleSaveAllSettings}
                                                disabled={isSavingSettings || !hasSettingsChanged()}
                                                className={`px-6 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-300 shadow-md active:scale-95 ${isSavingSettings || !hasSettingsChanged()
                                                    ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-50'
                                                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 hover:translate-y-[-1px]'
                                                    } flex items-center gap-2`}
                                            >
                                                {isSavingSettings ? (
                                                    <UrbanSetuSpinner size="sm" isBright={true} />
                                                ) : <FaSave size={14} />}
                                                {isSavingSettings ? 'Saving...' : 'Save Settings'}
                                            </button>
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
                                                    <UrbanSetuSpinner size="sm" />
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
                                                accept="image/*,audio/*,video/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.pptx"
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
                                                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
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
                                        className={`w-full p-2 rounded border ${isDarkMode ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
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

            {/* Ratings & Feedback Modal */}
            {
                showRatingsModal && createPortal(
                    <>
                        <div ref={ratingsModalContainerRef} onScroll={handleRatingsScroll} className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={() => setShowRatingsModal(false)}>
                            <div className="flex min-h-full items-center justify-center p-4">
                                <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-2xl rounded-xl shadow-2xl ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} animate-scaleIn`}>
                                <div className={`sticky top-0 z-10 p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} flex items-center justify-between rounded-t-xl`}>
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
                                            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                            title="Refresh"
                                        >
                                            {allRatingsLoading ? <UrbanSetuSpinner size="sm" /> : <FaSync size={16} />}
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
                                <div className={`sticky top-[73px] z-[9] px-6 py-3 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} flex gap-2`}>
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

                                <div className="p-6">
                                    {(currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) ? (
                                        allRatingsLoading ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                                <UrbanSetuSpinner size="md" />
                                                <p className="mt-3">Loading ratings...</p>
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
                                <div className={`sticky bottom-0 z-10 p-4 border-t flex justify-end ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} rounded-b-xl`}>
                                    <button
                                        onClick={() => setShowRatingsModal(false)}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                        {/* Mobile Scroll Assist Controls */}
                        <div className="fixed bottom-6 right-6 md:hidden flex flex-col gap-2 z-[70]" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    ratingsModalContainerRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
                                }}
                                disabled={ratingsScrollAtTop}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    ratingsScrollAtTop
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Up"
                            >
                                <FaArrowUp size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    ratingsModalContainerRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
                                }}
                                disabled={ratingsScrollAtBottom}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    ratingsScrollAtBottom
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Down"
                            >
                                <FaArrowDown size={16} />
                            </button>
                        </div>
                    </>
                    , document.body)
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

                @keyframes reminderFadeIn {
                  from {
                    opacity: 0;
                    transform: translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                .animate-reminder-item {
                  animation: reminderFadeIn 0.25s ease-out both;
                }

                @keyframes ring-bell {
                  0%, 100% { transform: rotate(0); }
                  15% { transform: rotate(15deg); }
                  30% { transform: rotate(-15deg); }
                  45% { transform: rotate(10deg); }
                  60% { transform: rotate(-10deg); }
                  75% { transform: rotate(4deg); }
                  90% { transform: rotate(-4deg); }
                }
                .animate-ring-bell {
                  animation: ring-bell 1.5s infinite;
                  transform-origin: top center;
                  display: inline-block;
                }
                
                @keyframes bandwidth {
                  0%, 100% { opacity: 0.4; transform: scale(0.9) rotate(20deg); }
                  50% { opacity: 1; transform: scale(1.15) rotate(20deg); }
                }
                .animate-bandwidth { animation: bandwidth 1.5s infinite ease-in-out; }

                @keyframes slideLeft {
                  from { opacity: 0; transform: translateX(20px) translateY(-50%); }
                  to { opacity: 1; transform: translateX(0) translateY(-50%); }
                }
                .animate-slideLeft { animation: slideLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
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
                @keyframes tokenFadeIn {
                  from { opacity: 0; transform: translateY(4px) scale(0.9); }
                  to { opacity: 1; transform: translateY(0) scale(1); }
                }
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
                
                /* Ensure proper text color inheritance in message bubbles - only for text content to avoid breaking component colors like ListingItem */
                .bg-gray-100.text-gray-800 .message-content-text * {
                    color: inherit !important;
                }
                .bg-gray-100.text-gray-800 .message-content-text span {
                    color: #1f2937 !important; /* text-gray-800 */
                }
                .bg-gray-100.text-gray-800 .message-content-text p {
                    color: #1f2937 !important; /* text-gray-800 */
                }
                .bg-gray-100.text-gray-800 .message-content-text div {
                    color: #1f2937 !important; /* text-gray-800 */
                }
                
                /* Ensure links maintain their blue color in light mode */
                .bg-gray-100.text-gray-800 a {
                    color: #2563eb !important; /* text-blue-600 */
                }
                .bg-gray-100.text-gray-800 a:hover {
                    color: #1d4ed8 !important; /* text-blue-800 */
                }
                
                /* Dark mode text color inheritance - scoped to text content */
                .bg-gray-800.text-gray-100 .message-content-text * {
                    color: inherit !important;
                }
                .bg-gray-800.text-gray-100 .message-content-text span {
                    color: #f3f4f6 !important; /* text-gray-100 */
                }
                .bg-gray-800.text-gray-100 .message-content-text p {
                    color: #f3f4f6 !important; /* text-gray-100 */
                }
                .bg-gray-800.text-gray-100 .message-content-text div {
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

            {/* Info Modal */}
            {
                showInfoModal && createPortal(
                    <>
                        <div ref={infoModalContainerRef} onScroll={handleInfoScroll} className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={() => setShowInfoModal(false)}>
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div
                                onClick={e => e.stopPropagation()}
                                className={`w-11/12 max-w-2xl rounded-xl shadow-xl relative ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            >
                                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b rounded-t-xl ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-white'}`}>
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

                                <div className="p-6 space-y-8">
                                    {/* Core Technology */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <FaCog className="text-indigo-500" />
                                            Powered By
                                        </h3>
                                        <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                                                <div className="space-y-2">
                                                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Processing</div>
                                                    <div className="text-xl font-bold font-mono text-purple-500">Gemini OCR & Media</div>
                                                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        Advanced image OCR, document extraction, and video analysis.
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
                                                { title: 'Multi-Modal & On-Device Face Recognition', desc: 'Advanced image OCR, on-device facial detection & descriptor matching, document analysis, voice input, and video processing.', icon: '📷' },
                                                { title: 'Code & Math', desc: 'Capable of calculating mortgage EMIs and formatting code.', icon: '🔢' },
                                                { title: 'AI & Manual Task Scheduler', desc: 'Schedule, reschedule, and manage task reminders and alarms in real-time via AI or manual creation.', icon: '⏰' },
                                                { title: 'Instant Translation', desc: 'Communicates fluently in multiple languages.', icon: '🌐' },
                                                { title: 'Think Longer', desc: 'Enables deep-thinking reasoning loops for advanced analytical queries and complex calculations.', icon: '💭' },
                                                { title: 'Search the Web', desc: 'Fetches real-time market updates, external listings, and news directly from the internet.', icon: '🌎' },
                                                { title: 'Drag & Drop / Paste Uploads', desc: 'Instantly upload files and documents (up to 10MB) by dragging and dropping them into the chat, or paste images directly from your clipboard.', icon: '📎' }
                                            ].map((feat, i) => (
                                                <div key={i} className={`p-4 rounded-xl border ${isDarkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'} transition-colors`}>
                                                    <div className="text-2xl mb-2">{feat.icon}</div>
                                                    <h4 className="font-semibold mb-1">{feat.title}</h4>
                                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{feat.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Keyboard Shortcuts */}
                                    <section>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <FaClipboardList className="text-blue-500" />
                                            Keyboard Shortcuts
                                        </h3>
                                        <div className={`p-5 rounded-2xl ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Focus text input</span>
                                                    <kbd className="px-2.5 py-1 rounded border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs font-mono font-semibold">Ctrl + /</kbd>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Upload File</span>
                                                    <kbd className="px-2.5 py-1 rounded border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs font-mono font-semibold">Ctrl + U</kbd>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Voice Input</span>
                                                    <kbd className="px-2.5 py-1 rounded border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs font-mono font-semibold">Ctrl + Shift + A</kbd>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Image Link</span>
                                                    <kbd className="px-2.5 py-1 rounded border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs font-mono font-semibold">Ctrl + Shift + I</kbd>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Think longer (deep thinking)</span>
                                                    <kbd className="px-2.5 py-1 rounded border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs font-mono font-semibold">Ctrl + Shift + M</kbd>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Search the web</span>
                                                    <kbd className="px-2.5 py-1 rounded border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-xs font-mono font-semibold">Ctrl + Shift + S</kbd>
                                                </div>
                                            </div>
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
                                        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mb-1.5 font-medium`}>
                                            SetuAI can make mistakes. Check important info.
                                        </p>
                                        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                            SetuAI v2.5.0 • Build 2024.12 • Powered by Sentinel UrbanSetu Tech Labs
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                        {/* Mobile Scroll Assist Controls */}
                        <div className="fixed bottom-6 right-6 md:hidden flex flex-col gap-2 z-[110]" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    infoModalContainerRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
                                }}
                                disabled={infoScrollAtTop}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    infoScrollAtTop
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Up"
                            >
                                <FaArrowUp size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    infoModalContainerRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
                                }}
                                disabled={infoScrollAtBottom}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    infoScrollAtBottom
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Down"
                            >
                                <FaArrowDown size={16} />
                            </button>
                        </div>
                    </>
                    , document.body)
            }

            {/* Terms and Conditions Modal */}
            {
                showTermsModal && createPortal(
                    <>
                        <div ref={termsModalContainerRef} onScroll={handleTermsScroll} className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={handleCloseTermsModal}>
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div
                                onClick={e => e.stopPropagation()}
                                className={`w-11/12 max-w-2xl rounded-xl shadow-xl relative ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            >
                                {/* Header */}
                                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b rounded-t-xl ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-white'}`}>
                                    <div className="flex items-center gap-3">
                                        <FaFileAlt className="text-blue-500 text-xl" />
                                        <h2 className="text-xl font-bold">Terms of Service</h2>
                                    </div>
                                    <button
                                        onClick={handleCloseTermsModal}
                                        className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                                    >
                                        <FaTimes size={20} />
                                    </button>
                                </div>

                                {/* Scrollable Content */}
                                <div className="p-6 space-y-6">
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
                                            <h3 className="font-bold text-lg mb-2 text-blue-500">5. Safety Policy & Cooldown</h3>
                                            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                                                To ensure a safe environment for all users, we strictly enforce our safety policies.
                                                Repeated violations (3 or more) of our content guidelines will result in an automatic temporary block.
                                            </p>
                                            <div className={`mt-3 p-3 rounded-lg border ${isDarkMode ? 'bg-red-900/10 border-red-900/30 text-red-400' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                                <p className="font-bold mb-1">Cooldown Rules:</p>
                                                <ul className="list-disc pl-5 text-sm space-y-1">
                                                    <li>Violation limit: 3 incidents.</li>
                                                    <li>Suspension duration: 24 hours per block.</li>
                                                    <li>During suspension: Chat input, editing, retry options, and smart suggestions will be completely disabled.</li>
                                                    <li>Status is tracked per user (or per device for public visitors).</li>
                                                </ul>
                                            </div>
                                        </section>

                                        <section>
                                            <h3 className="font-bold text-lg mb-2 text-blue-500">6. Changes to Terms</h3>
                                            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                                                We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of updated terms.
                                            </p>
                                        </section>
                                    </div>

                                    {/* Footer Action */}
                                    <div className={`p-4 border-t flex flex-col sm:flex-row gap-4 justify-between items-center ${isDarkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'}`}>
                                        <p className={`text-xs text-center sm:text-left ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} max-w-sm`}>
                                            For comprehensive platform policies, please read our full <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline font-medium transition-colors">Terms & Conditions</a>.
                                        </p>
                                        {openedTermsFromConsent ? (
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button
                                                    onClick={() => {
                                                        setShowTermsModal(false);
                                                        setShowConsentModal(true);
                                                        setOpenedTermsFromConsent(false);
                                                    }}
                                                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'}`}
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        acceptTerms(e);
                                                        setShowTermsModal(false);
                                                        setOpenedTermsFromConsent(false);
                                                    }}
                                                    className="flex-1 sm:flex-initial px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
                                                >
                                                    Accept & Continue
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleCloseTermsModal}
                                                className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                                            >
                                                Close
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                        {/* Mobile Scroll Assist Controls */}
                        <div className="fixed bottom-6 right-6 md:hidden flex flex-col gap-2 z-[110]" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    termsModalContainerRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
                                }}
                                disabled={termsScrollAtTop}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    termsScrollAtTop
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Up"
                            >
                                <FaArrowUp size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    termsModalContainerRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
                                }}
                                disabled={termsScrollAtBottom}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    termsScrollAtBottom
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Down"
                            >
                                <FaArrowDown size={16} />
                            </button>
                        </div>
                    </>
                    , document.body)
            }

            {/* Mandatory Consent Modal */}
            {
                showConsentModal && createPortal(
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn cursor-default">
                        <div className={`w-full max-w-md rounded-3xl shadow-2xl p-8 text-center transform transition-all animate-bounceIn ${isDarkMode ? 'bg-gray-900 text-gray-100 border border-gray-700' : 'bg-white text-gray-900'}`}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenedTermsFromConsent(true);
                                        setShowConsentModal(false);
                                        setShowTermsModal(true);
                                    }}
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
                    , document.body)
            }

            {
                showReportModal && createPortal(
                    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div
                                onClick={e => e.stopPropagation()}
                                className={`w-full max-w-lg rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            >
                                {/* Header */}
                                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b rounded-t-2xl ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-white'}`}>
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
                                <div className="p-6">
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
                                                    className={`px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-all shadow-lg hover:shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                                                >
                                                    {isReporting ? (
                                                        <>
                                                            <UrbanSetuSpinner size="sm" isBright={true} />
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
                    </div>
                    , document.body)
            }

            {/* Admin Reports Management Modal */}
            {
                showAdminReportsModal && createPortal(
                    <>
                        <div ref={adminReportsModalContainerRef} onScroll={handleAdminReportsScroll} className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={() => setShowAdminReportsModal(false)}>
                            <div className="flex min-h-full items-center justify-center p-4">
                                <div
                                    onClick={e => e.stopPropagation()}
                                    className={`w-full max-w-5xl rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                                >
                                    {/* Header */}
                                    <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b rounded-t-2xl ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-white'}`}>
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
                                                className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'} flex items-center justify-center`}
                                            >
                                                {adminReportsLoading ? <UrbanSetuSpinner size="sm" /> : <FaSync size={16} />}
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
                                    <div className={`sticky top-[73px] z-[9] p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-white'} flex gap-2 overflow-x-auto`}>
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
                                    <div className="p-6">
                                        {adminReportsLoading ? (
                                            <div className="flex justify-center items-center h-full">
                                                <UrbanSetuSpinner size="xl" />
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
                        </div>
                        {/* Mobile Scroll Assist Controls */}
                        <div className="fixed bottom-6 right-6 md:hidden flex flex-col gap-2 z-[105]" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    adminReportsModalContainerRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
                                }}
                                disabled={adminReportsScrollAtTop}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    adminReportsScrollAtTop
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Up"
                            >
                                <FaArrowUp size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    adminReportsModalContainerRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
                                }}
                                disabled={adminReportsScrollAtBottom}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    adminReportsScrollAtBottom
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Down"
                            >
                                <FaArrowDown size={16} />
                            </button>
                        </div>
                    </>
                    , document.body)
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
                                className={`w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-4 ${isDarkMode ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'}`}
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
                showRatingDetailModal && selectedRating && createPortal(
                    <>
                        <div ref={ratingDetailModalContainerRef} onScroll={handleRatingDetailScroll} className="fixed inset-0 z-[110] overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={() => setShowRatingDetailModal(false)}>
                            <div className="flex min-h-full items-center justify-center p-4">
                                <div
                                    onClick={e => e.stopPropagation()}
                                className={`w-full max-w-2xl rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
                            >
                                {/* Header */}
                                <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b rounded-t-2xl ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-white'}`}>
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
                                <div className="p-6">
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
                        </div>
                        {/* Mobile Scroll Assist Controls */}
                        <div className="fixed bottom-6 right-6 md:hidden flex flex-col gap-2 z-[120]" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    ratingDetailModalContainerRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
                                }}
                                disabled={ratingDetailScrollAtTop}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    ratingDetailScrollAtTop
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Up"
                            >
                                <FaArrowUp size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    ratingDetailModalContainerRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
                                }}
                                disabled={ratingDetailScrollAtBottom}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    ratingDetailScrollAtBottom
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Down"
                            >
                                <FaArrowDown size={16} />
                            </button>
                        </div>
                    </>
                    , document.body)
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
                    <>
                        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportDetailModal(false)}>
                            <div
                                onClick={e => e.stopPropagation()}
                                className={`w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
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
                                <div ref={reportDetailModalContainerRef} onScroll={handleReportDetailScroll} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
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
                        {/* Mobile Scroll Assist Controls */}
                        <div className="fixed bottom-6 right-6 md:hidden flex flex-col gap-2 z-[120]" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    reportDetailModalContainerRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
                                }}
                                disabled={reportDetailScrollAtTop}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    reportDetailScrollAtTop
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Up"
                            >
                                <FaArrowUp size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    reportDetailModalContainerRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
                                }}
                                disabled={reportDetailScrollAtBottom}
                                className={`p-3 rounded-full shadow-lg transition-all border ${
                                    reportDetailScrollAtBottom
                                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 cursor-not-allowed opacity-50'
                                        : 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 hover:scale-105 active:scale-95'
                                }`}
                                title="Scroll Down"
                            >
                                <FaArrowDown size={16} />
                            </button>
                        </div>
                    </>
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

            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={deleteReminderId !== null}
                onClose={() => setDeleteReminderId(null)}
                onConfirm={() => {
                    if (deleteReminderId) {
                        handleDeleteReminder(deleteReminderId);
                    }
                }}
                title="Cancel Reminder"
                message="Are you sure you want to cancel this reminder?"
                confirmText="Cancel Reminder"
                cancelText="Keep Reminder"
                isDestructive={true}
            />
            <ConfirmationModal
                isOpen={showUnsavedSettingsModal}
                onClose={() => setShowUnsavedSettingsModal(false)}
                onConfirm={discardSettingsChanges}
                title="Unsaved Changes"
                message="You have modified your settings but haven't saved them. Are you sure you want to discard these changes?"
                confirmText="Discard Changes"
                cancelText="Keep Editing"
                isDestructive={true}
            />
            {/* Image Preview Modal */}
            <ImagePreview
                isOpen={isImagePreviewOpen}
                onClose={() => setIsImagePreviewOpen(false)}
                images={previewImages}
                initialIndex={previewImageIndex}
                onFaceDetected={(name, details, descriptor) => {
                    registerFace(name, descriptor, details);
                }}
            />

            {/* Image Link Modal */}
            {showImageLinkModal && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => { setShowImageLinkModal(false); setImageLinkUrls([]); }}>
                    <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl overflow-hidden border-2 transform transition-all scale-100 ${isDarkMode ? 'bg-gray-900 border-indigo-900/50 text-white' : 'bg-white border-indigo-100 text-gray-900'}`} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                                    <FaLink size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Image URL</h3>
                                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Add images from the web</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleImageLinkSubmit} className="space-y-4">
                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Add Image Address
                                </label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1 group">
                                        <input
                                            type="text"
                                            value={imageLinkInput}
                                            onChange={(e) => setImageLinkInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddUrlToList();
                                                }
                                            }}
                                            placeholder="https://example.com/image.jpg"
                                            className={`w-full pl-4 pr-12 py-3 rounded-xl border-2 focus:outline-none transition-all duration-300 ${isDarkMode
                                                ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500/50 placeholder-gray-500'
                                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-400/50 placeholder-gray-400'
                                                }`}
                                            autoFocus
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
                                            <FaImage size={18} className={isDarkMode ? 'text-indigo-400' : 'text-indigo-500'} />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddUrlToList}
                                        disabled={!imageLinkInput.trim()}
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 shadow-md ${imageLinkInput.trim()
                                            ? `bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90 active:scale-95 shadow-indigo-500/20`
                                            : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-300 dark:border-gray-700'
                                            }`}
                                        title="Add URL to list"
                                    >
                                        <FaPlus size={16} />
                                    </button>
                                </div>

                                {/* URL Image Preview List */}
                                {imageLinkUrls.length > 0 && (
                                    <div className="mt-4 animate-fadeIn max-h-48 overflow-y-auto pr-1">
                                        <div className={`p-2.5 rounded-xl border-2 transition-all duration-300 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-indigo-100'}`}>
                                            <div className="grid grid-cols-3 gap-2">
                                                {imageLinkUrls.map((url, idx) => (
                                                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group/preview bg-black/5 border border-gray-200 dark:border-gray-700">
                                                        <img
                                                            src={url}
                                                            alt={`Preview ${idx + 1}`}
                                                            className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                            onLoad={(e) => {
                                                                e.target.style.display = 'block';
                                                                e.target.nextSibling.style.display = 'none';
                                                            }}
                                                            onClick={() => {
                                                                setPreviewImages(imageLinkUrls);
                                                                setPreviewImageIndex(idx);
                                                                setIsImagePreviewOpen(true);
                                                            }}
                                                        />
                                                        <div className="hidden absolute inset-0 flex-col items-center justify-center text-gray-400 text-center p-1">
                                                            <FaImage size={16} className="opacity-20 mb-0.5" />
                                                            <span className="text-[8px] font-medium opacity-50 leading-none">Error</span>
                                                        </div>
                                                        
                                                        {/* Delete Overlay */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveUrlFromList(url);
                                                            }}
                                                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-700 transition-colors"
                                                            title="Remove image"
                                                        >
                                                            <FaTimes size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <p className={`mt-2 text-[10px] leading-relaxed italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Tip: You can add up to 5 images per message. Type a URL and click "+" to add it.
                                </p>
                            </div>

                            <div className={`p-4 rounded-xl border border-dashed flex items-center gap-3 ${isDarkMode ? 'bg-indigo-900/10 border-indigo-800/50' : 'bg-indigo-50/50 border-indigo-200'}`}>
                                <div className="p-2 bg-indigo-500 rounded-lg text-white animate-pulse">
                                    <FaShieldAlt size={16} />
                                </div>
                                <div className="flex-1">
                                    <div className={`text-[11px] font-bold uppercase ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>Sentinel AI Protection</div>
                                    <div className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>External images are sent with your message and processed by AI on the server.</div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowImageLinkModal(false); setImageLinkUrls([]); }}
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={imageLinkUrls.length === 0 && !imageLinkInput.trim()}
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 ${(imageLinkUrls.length > 0 || imageLinkInput.trim())
                                        ? `bg-gradient-to-r ${themeColors.primary} text-white hover:opacity-90 active:scale-[0.98]`
                                        : 'bg-gray-300 dark:bg-gray-700 text-white cursor-not-allowed'
                                        }`}
                                >
                                    Add
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Coin Burst Animation for Token Usage Feedback */}
            {showCoinBurst && (
                <SetuCoinParticles
                    active={true}
                    count={burstCount}
                    onComplete={() => setShowCoinBurst(false)}
                />
            )}

            {/* Policy Violation Modal */}
            {showViolationModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-2 ${isDarkMode ? 'bg-gray-900 border-red-900/50' : 'bg-white border-red-100'} animate-scaleIn`}>
                        <div className={`${isBlockedByPolicy ? 'bg-red-600' : 'bg-blue-600'} p-6 flex items-center justify-center relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                            {isBlockedByPolicy ? (
                                <FaBan size={48} className="text-white relative z-10" />
                            ) : (
                                <FaShieldAlt size={48} className="text-white relative z-10" />
                            )}
                        </div>
                        <div className="p-8 text-center">
                            <h3 className={`text-2xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900 uppercase tracking-tighter'}`}>
                                {isBlockedByPolicy ? 'Access Restricted' : 'Safety Policy Status'}
                            </h3>
                            <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {isBlockedByPolicy
                                    ? 'Your access to the SetuAI chatbot has been temporarily restricted due to repeated safety policy violations.'
                                    : 'Your account has recorded one or more safety policy violations. Please review our usage guidelines to avoid further restrictions.'
                                }
                            </p>

                            <div className={`p-4 rounded-xl mb-6 text-left ${isDarkMode ? 'bg-gray-800' : isBlockedByPolicy ? 'bg-red-50' : 'bg-blue-50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${isBlockedByPolicy ? 'text-red-500' : 'text-blue-500'}`}>
                                        {isBlockedByPolicy ? 'Cooldown Status' : 'Account Health'}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDarkMode
                                        ? (isBlockedByPolicy ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300')
                                        : (isBlockedByPolicy ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')
                                        }`}>
                                        {isBlockedByPolicy ? 'Active' : 'Warning'}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {isBlockedByPolicy && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs opacity-70">Remaining Time:</span>
                                            <span className="text-xs font-bold">~{Math.max(0, Math.ceil((cooldownEnd - Date.now()) / (60 * 60 * 1000)))} hours</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs opacity-70">Violation Limit:</span>
                                        <span className="text-xs font-bold">{policyViolations} / {VIOLATION_LIMIT}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => { setShowViolationModal(false); setShowTermsModal(true); }}
                                    className={`w-full py-3 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600 border border-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
                                >
                                    <FaFileAlt size={16} /> Read Usage Policy
                                </button>
                                <button
                                    onClick={() => setShowViolationModal(false)}
                                    className={`w-full py-3 ${isBlockedByPolicy ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'} text-white rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95`}
                                >
                                    Understand & Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Face Tagging Modal */}
            {faceTaggingModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
                    <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border transform transition-all animate-scaleUp ${isDarkMode ? 'bg-gray-950 border-gray-805 text-white' : 'bg-white border-gray-100 text-gray-800'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-2xl ${isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-650'}`}>
                                    <FaUser size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Tag Detected Face</h3>
                                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Associate a name with this face for future recognition</p>
                                </div>
                            </div>
                            {/* Refresh Button */}
                            <button
                                type="button"
                                disabled={isFaceTagRefreshing}
                                onClick={handleFaceTagRefresh}
                                className={`p-2 rounded-xl transition-all duration-300 ${isDarkMode ? 'hover:bg-gray-900 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'} ${isFaceTagRefreshing ? 'cursor-not-allowed animate-pulse' : 'hover:scale-[1.02] active:scale-95'}`}
                                title="Sync from backend"
                            >
                                <FaSync className={`${isFaceTagRefreshing ? 'animate-spin text-purple-500' : ''}`} size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleFaceTagSubmit} className="space-y-4">
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Person's Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    disabled={isFaceTagRefreshing}
                                    value={faceTaggingModal.name}
                                    onChange={(e) => setFaceTaggingModal(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Mahesh Babu"
                                    className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all outline-none ${
                                        isDarkMode
                                            ? 'bg-gray-900 border-gray-800 focus:border-purple-500/80 text-white focus:bg-gray-900'
                                            : 'bg-gray-50 border-gray-200 focus:border-purple-500 text-gray-800 focus:bg-white'
                                    } ${isFaceTagRefreshing ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-900' : ''}`}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Person's Details <span className={`font-normal normal-case tracking-normal ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>(optional)</span>
                                </label>
                                <textarea
                                    disabled={isFaceTagRefreshing}
                                    value={faceTaggingModal.details}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 200) {
                                            setFaceTaggingModal(prev => ({ ...prev, details: e.target.value }));
                                        }
                                    }}
                                    maxLength={200}
                                    rows={2}
                                    placeholder="e.g. Indian cricketer, captain of CSK"
                                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none resize-none ${
                                        isDarkMode
                                            ? 'bg-gray-900 border-gray-800 focus:border-purple-500/80 text-white focus:bg-gray-900'
                                            : 'bg-gray-50 border-gray-200 focus:border-purple-500 text-gray-800 focus:bg-white'
                                    } ${isFaceTagRefreshing ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-900' : ''}`}
                                />
                                {faceTaggingModal.details.length > 120 && (
                                    <p className={`text-[10px] text-right mt-1 ${faceTaggingModal.details.length >= 200 ? 'text-red-400' : isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {faceTaggingModal.details.length}/200 chars
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={isFaceTagRefreshing}
                                    onClick={() => setFaceTaggingModal({ isOpen: false, imgId: null, faceIndex: null, descriptor: null, name: '', details: '' })}
                                    className={`w-full py-3 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 border ${isDarkMode ? 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'} ${isFaceTagRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isFaceTagRefreshing}
                                    className={`w-full py-3 bg-purple-600 hover:bg-purple-750 shadow-lg shadow-purple-500/20 text-white rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${isFaceTagRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isFaceTagRefreshing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <FaSync className="animate-spin" size={14} /> Syncing...
                                        </span>
                                    ) : (
                                        "Save Tag"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeminiChatbox;
