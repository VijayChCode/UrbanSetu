import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from 'react-dom';
import { FaTrash, FaSearch, FaPen, FaPaperPlane, FaUser, FaEnvelope, FaStar, FaRegStar, FaSync, FaCalendar, FaPhone, FaVideo, FaVideoSlash, FaMicrophoneSlash, FaUserShield, FaArchive, FaUndo, FaCommentDots, FaCheck, FaCheckDouble, FaBan, FaTimes, FaLightbulb, FaCopy, FaEllipsisV, FaFlag, FaCalendarAlt, FaCheckSquare, FaDownload, FaDollarSign, FaHistory, FaCircle, FaVolumeUp, FaVolumeMute, FaEye, FaEyeSlash, FaExpand, FaCompress, FaPowerOff, FaCog, FaFileAlt, FaPlay, FaInfoCircle } from "react-icons/fa";
import UrbanSetuSpinner from "../components/UrbanSetuSpinner";
import { FormattedTextWithLinks, FormattedTextWithLinksAndSearch, FormattedTextWithReadMore } from '../utils/linkFormatter.jsx';
import UserAvatar from '../components/UserAvatar';
import { focusWithoutKeyboard, focusWithKeyboard } from '../utils/mobileUtils';
import { getThemeColors, getDarkModeContainerClass, getDarkModeInputClass, getDarkModeTextClass, getDarkModeSecondaryTextClass, getDarkModeBorderClass, getDarkModeHoverClass } from '../utils/chatTheme';
import ImagePreview from '../components/ImagePreview';
import VideoMessageBubble from '../components/VideoMessageBubble';

import LinkPreview from '../components/LinkPreview';
import { EmojiButton } from '../components/EmojiPicker';
import { useSelector, useDispatch } from "react-redux";
import { useState as useLocalState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import { socket } from "../utils/socket";
import SimplePeer from 'simple-peer';
import { useSoundEffects } from "../components/SoundEffects";
import { exportEnhancedChatToPDF } from '../utils/pdfExport';
import ExportChatModal from '../components/ExportChatModal';
import CallHistoryModal from '../components/CallHistoryModal';
import { authenticatedFetch } from '../utils/csrf';
import ChatSettingsModal from '../components/ChatSettingsModal';
import { useChatSettings } from '../hooks/useChatSettings';
import { usePageTitle } from '../hooks/usePageTitle';
import { useSignout } from '../hooks/useSignout';
// Note: Do not import server-only libs here
import { useAudioActivity } from '../hooks/useAudioActivity';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import AdminAppointmentsSkeleton from '../components/skeletons/AdminAppointmentsSkeleton';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminAppointments() {
  // Set page title
  usePageTitle("Appointment Management - Admin Panel");

  const { currentUser } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { signout } = useSignout();
  const { playMessageReceived } = useSoundEffects();

  // Video Preview State


  // Handle navigation state when coming from direct chat link
  const location = useLocation();
  const params = useParams();
  const [shouldOpenChatFromNotification, setShouldOpenChatFromNotification] = useState(false);
  const [activeChatAppointmentId, setActiveChatAppointmentId] = useState(null);
  const [missingChatbookError, setMissingChatbookError] = useState(null);
  const chatResolveRef = useRef(false);
  const chatIntervalRef = useRef(null);
  const chatTimeoutRef = useRef(null);

  // Function to handle phone number clicks
  const handlePhoneClick = (phoneNumber) => {
    // Check if it's a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // For mobile devices, open phone dialer
      window.location.href = `tel:${phoneNumber}`;
    } else {
      // For desktop, copy to clipboard
      navigator.clipboard.writeText(phoneNumber).then(() => {
        toast.success(`Phone number ${phoneNumber} copied to clipboard!`);
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = phoneNumber;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success(`Phone number ${phoneNumber} copied to clipboard!`);
      });
    }
  };
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [archivedAppointments, setArchivedAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  // Removed role filter
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [archivedCurrentPage, setArchivedCurrentPage] = useState(1);
  const [archivedTotalPages, setArchivedTotalPages] = useState(1);
  const [filteredArchivedAppointments, setFilteredArchivedAppointments] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isMobile, setIsMobile] = useLocalState(window.innerWidth <= 768);

  // State for appointment action modals
  const [appointmentToHandle, setAppointmentToHandle] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReinitiateModal, setShowReinitiateModal] = useState(false);
  const [reinitiatePaymentStatus, setReinitiatePaymentStatus] = useState(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);

  // Chat settings
  const { settings, updateSetting } = useChatSettings('admin_appointments_chat_settings');
  const [showChatSettings, setShowChatSettings] = useState(false);

  // Compute theme colors and dark mode from settings
  const themeColors = useMemo(() => getThemeColors(settings.themeColor || 'blue'), [settings.themeColor]);
  const isDarkMode = settings.theme === 'dark';

  // Handle mobile state updates
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reactions state
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [reactionsMessageId, setReactionsMessageId] = useState(null);
  const [showReactionsEmojiPicker, setShowReactionsEmojiPicker] = useState(false);
  const [reactionEmojiSearchTerm, setReactionEmojiSearchTerm] = useState('');

  // Comprehensive emoji data with keywords for search
  const emojiData = [
    // Smileys & People
    { emoji: '😀', keywords: ['grinning', 'happy', 'smile', 'joy'] },
    { emoji: '😃', keywords: ['grinning', 'happy', 'smile', 'joy', 'smiley'] },
    { emoji: '😄', keywords: ['grinning', 'happy', 'smile', 'joy', 'laugh'] },
    { emoji: '😁', keywords: ['grinning', 'happy', 'smile', 'joy', 'beaming'] },
    { emoji: '😆', keywords: ['grinning', 'happy', 'smile', 'joy', 'laugh', 'squinting'] },
    { emoji: '😅', keywords: ['grinning', 'happy', 'smile', 'sweat', 'relief'] },
    { emoji: '😂', keywords: ['joy', 'laugh', 'tears', 'funny', 'lol', 'crying'] },
    { emoji: '🤣', keywords: ['rolling', 'laugh', 'funny', 'lol', 'rofl'] },
    { emoji: '😊', keywords: ['smiling', 'happy', 'blush', 'smile'] },
    { emoji: '😇', keywords: ['innocent', 'angel', 'halo', 'good'] },
    { emoji: '🙂', keywords: ['slightly', 'smiling', 'happy'] },
    { emoji: '🙃', keywords: ['upside', 'down', 'silly', 'sarcastic'] },
    { emoji: '😉', keywords: ['winking', 'flirt', 'wink'] },
    { emoji: '😌', keywords: ['relieved', 'peaceful', 'calm'] },
    { emoji: '😍', keywords: ['heart', 'eyes', 'love', 'adore', 'crush'] },
    { emoji: '🥰', keywords: ['smiling', 'hearts', 'love', 'adore'] },
    { emoji: '😘', keywords: ['kiss', 'love', 'heart'] },
    { emoji: '😗', keywords: ['kissing', 'kiss'] },
    { emoji: '😙', keywords: ['kissing', 'smiling', 'eyes'] },
    { emoji: '😚', keywords: ['kissing', 'closed', 'eyes'] },
    { emoji: '😋', keywords: ['yummy', 'delicious', 'tongue'] },
    { emoji: '😛', keywords: ['tongue', 'out', 'playful'] },
    { emoji: '😝', keywords: ['tongue', 'winking', 'playful'] },
    { emoji: '😜', keywords: ['tongue', 'winking', 'crazy'] },
    { emoji: '🤪', keywords: ['zany', 'crazy', 'wild'] },
    { emoji: '🤨', keywords: ['raised', 'eyebrow', 'suspicious'] },
    { emoji: '🧐', keywords: ['monocle', 'thinking', 'pondering'] },
    { emoji: '🤓', keywords: ['nerd', 'geek', 'glasses'] },
    { emoji: '😎', keywords: ['cool', 'sunglasses', 'awesome'] },
    { emoji: '🤩', keywords: ['star', 'struck', 'excited'] },
    { emoji: '🥳', keywords: ['party', 'celebration', 'hat'] },
    { emoji: '😏', keywords: ['smirk', 'sly', 'mischievous'] },
    { emoji: '😒', keywords: ['unamused', 'bored', 'meh'] },
    { emoji: '😞', keywords: ['disappointed', 'sad'] },
    { emoji: '😔', keywords: ['pensive', 'sad', 'thoughtful'] },
    { emoji: '😟', keywords: ['worried', 'concerned'] },
    { emoji: '😕', keywords: ['confused', 'slightly', 'frowning'] },
    { emoji: '🙁', keywords: ['slightly', 'frowning', 'sad'] },
    { emoji: '☹️', keywords: ['frowning', 'sad'] },
    { emoji: '😣', keywords: ['persevering', 'struggling'] },
    { emoji: '😖', keywords: ['confounded', 'frustrated'] },
    { emoji: '😫', keywords: ['tired', 'exhausted'] },
    { emoji: '😩', keywords: ['weary', 'tired'] },
    { emoji: '🥺', keywords: ['pleading', 'puppy', 'eyes'] },
    { emoji: '😢', keywords: ['crying', 'sad', 'tear'] },
    { emoji: '😭', keywords: ['loudly', 'crying', 'sad', 'bawling'] },
    { emoji: '😤', keywords: ['huffing', 'angry', 'steam'] },
    { emoji: '😠', keywords: ['angry', 'mad'] },
    { emoji: '😡', keywords: ['pouting', 'angry', 'rage'] },
    { emoji: '🤬', keywords: ['swearing', 'cursing', 'angry'] },
    { emoji: '🤯', keywords: ['exploding', 'head', 'mind', 'blown'] },
    { emoji: '😳', keywords: ['flushed', 'embarrassed'] },
    { emoji: '🥵', keywords: ['hot', 'sweating'] },
    { emoji: '🥶', keywords: ['cold', 'freezing'] },
    { emoji: '😱', keywords: ['screaming', 'fear', 'shocked'] },
    { emoji: '😨', keywords: ['fearful', 'scared'] },
    { emoji: '😰', keywords: ['anxious', 'sweat', 'worried'] },
    { emoji: '😥', keywords: ['sad', 'relieved', 'disappointed'] },
    { emoji: '😓', keywords: ['downcast', 'sweat', 'sad'] },
    { emoji: '🤗', keywords: ['hugging', 'hug', 'embrace'] },
    { emoji: '🤔', keywords: ['thinking', 'pondering'] },
    { emoji: '🤭', keywords: ['hand', 'over', 'mouth', 'giggle'] },
    { emoji: '🤫', keywords: ['shushing', 'quiet', 'secret'] },
    { emoji: '🤥', keywords: ['lying', 'pinocchio'] },
    { emoji: '😶', keywords: ['no', 'mouth', 'speechless'] },
    { emoji: '😐', keywords: ['neutral', 'expressionless'] },
    { emoji: '😑', keywords: ['expressionless', 'blank'] },
    { emoji: '😯', keywords: ['hushed', 'surprised'] },
    { emoji: '😦', keywords: ['frowning', 'open', 'mouth'] },
    { emoji: '😧', keywords: ['anguished', 'shocked'] },
    { emoji: '😮', keywords: ['open', 'mouth', 'surprised', 'wow'] },
    { emoji: '😲', keywords: ['astonished', 'shocked'] },
    { emoji: '🥱', keywords: ['yawning', 'tired', 'sleepy'] },
    { emoji: '😴', keywords: ['sleeping', 'zzz', 'tired'] },
    { emoji: '🤤', keywords: ['drooling', 'sleepy'] },
    { emoji: '😪', keywords: ['sleepy', 'tired'] },
    { emoji: '😵', keywords: ['dizzy', 'confused'] },
    { emoji: '🤐', keywords: ['zipper', 'mouth', 'quiet'] },
    { emoji: '🥴', keywords: ['woozy', 'drunk', 'dizzy'] },
    { emoji: '🤢', keywords: ['nauseated', 'sick'] },
    { emoji: '🤮', keywords: ['vomiting', 'sick'] },
    { emoji: '🤧', keywords: ['sneezing', 'sick'] },
    { emoji: '😷', keywords: ['mask', 'sick', 'medical'] },
    { emoji: '🤒', keywords: ['thermometer', 'sick', 'fever'] },
    { emoji: '🤕', keywords: ['bandage', 'hurt', 'injured'] },
    { emoji: '🤑', keywords: ['money', 'mouth', 'rich'] },
    { emoji: '🤠', keywords: ['cowboy', 'hat'] },
    { emoji: '💀', keywords: ['skull', 'death', 'dead'] },
    { emoji: '👻', keywords: ['ghost', 'spooky'] },
    { emoji: '👽', keywords: ['alien', 'extraterrestrial'] },
    { emoji: '👾', keywords: ['alien', 'monster', 'game'] },
    { emoji: '🤖', keywords: ['robot', 'bot'] },
    { emoji: '😈', keywords: ['smiling', 'devil', 'evil'] },
    { emoji: '👿', keywords: ['angry', 'devil', 'evil'] },
    { emoji: '👹', keywords: ['ogre', 'monster'] },
    { emoji: '👺', keywords: ['goblin', 'monster'] },

    // Gestures & Body Parts
    { emoji: '💪', keywords: ['flexed', 'biceps', 'strong', 'muscle'] },
    { emoji: '👍', keywords: ['thumbs', 'up', 'good', 'yes', 'like', 'approve'] },
    { emoji: '👎', keywords: ['thumbs', 'down', 'bad', 'no', 'dislike'] },
    { emoji: '👌', keywords: ['ok', 'okay', 'perfect'] },
    { emoji: '✌️', keywords: ['victory', 'peace', 'two'] },
    { emoji: '🤞', keywords: ['crossed', 'fingers', 'luck'] },
    { emoji: '🤟', keywords: ['love', 'you', 'gesture'] },
    { emoji: '🤘', keywords: ['rock', 'on', 'horns'] },
    { emoji: '🤙', keywords: ['call', 'me', 'hang', 'loose'] },
    { emoji: '👈', keywords: ['pointing', 'left'] },
    { emoji: '👉', keywords: ['pointing', 'right'] },
    { emoji: '👆', keywords: ['pointing', 'up'] },
    { emoji: '👇', keywords: ['pointing', 'down'] },
    { emoji: '☝️', keywords: ['index', 'pointing', 'up'] },
    { emoji: '👋', keywords: ['waving', 'hand', 'hello', 'goodbye'] },
    { emoji: '🤚', keywords: ['raised', 'back', 'hand'] },
    { emoji: '🖐️', keywords: ['hand', 'five', 'fingers'] },
    { emoji: '✋', keywords: ['raised', 'hand', 'stop'] },
    { emoji: '🖖', keywords: ['vulcan', 'salute', 'spock'] },
    { emoji: '🤌', keywords: ['pinched', 'fingers'] },
    { emoji: '🤏', keywords: ['pinching', 'hand'] },

    // Animals & Nature
    { emoji: '🐶', keywords: ['dog', 'puppy', 'pet'] },
    { emoji: '🐱', keywords: ['cat', 'kitten', 'pet'] },
    { emoji: '🐭', keywords: ['mouse', 'rodent'] },
    { emoji: '🐹', keywords: ['hamster', 'pet'] },
    { emoji: '🐰', keywords: ['rabbit', 'bunny'] },
    { emoji: '🦊', keywords: ['fox'] },
    { emoji: '🐻', keywords: ['bear'] },
    { emoji: '🐼', keywords: ['panda', 'bear'] },
    { emoji: '🐨', keywords: ['koala'] },
    { emoji: '🐯', keywords: ['tiger'] },
    { emoji: '🦁', keywords: ['lion'] },
    { emoji: '🐮', keywords: ['cow'] },
    { emoji: '🐷', keywords: ['pig'] },
    { emoji: '🐸', keywords: ['frog'] },
    { emoji: '🐵', keywords: ['monkey'] },
    { emoji: '🙈', keywords: ['see', 'no', 'evil', 'monkey'] },
    { emoji: '🙉', keywords: ['hear', 'no', 'evil', 'monkey'] },
    { emoji: '🙊', keywords: ['speak', 'no', 'evil', 'monkey'] },
    { emoji: '🐒', keywords: ['monkey'] },
    { emoji: '🐔', keywords: ['chicken'] },
    { emoji: '🐧', keywords: ['penguin'] },
    { emoji: '🐦', keywords: ['bird'] },
    { emoji: '🐤', keywords: ['baby', 'chick'] },
    { emoji: '🐣', keywords: ['hatching', 'chick'] },
    { emoji: '🦆', keywords: ['duck'] },
    { emoji: '🦅', keywords: ['eagle'] },
    { emoji: '🦉', keywords: ['owl'] },
    { emoji: '🦇', keywords: ['bat'] },
    { emoji: '🐺', keywords: ['wolf'] },
    { emoji: '🐗', keywords: ['boar'] },
    { emoji: '🐴', keywords: ['horse'] },
    { emoji: '🦄', keywords: ['unicorn', 'magical'] },
    { emoji: '🐝', keywords: ['bee', 'honeybee'] },
    { emoji: '🐛', keywords: ['bug', 'insect'] },
    { emoji: '🦋', keywords: ['butterfly'] },
    { emoji: '🐌', keywords: ['snail'] },
    { emoji: '🐞', keywords: ['ladybug', 'beetle'] },
    { emoji: '🐜', keywords: ['ant'] },
    { emoji: '🦟', keywords: ['mosquito'] },
    { emoji: '🦗', keywords: ['cricket'] },
    { emoji: '🕷️', keywords: ['spider'] },
    { emoji: '🕸️', keywords: ['spider', 'web'] },
    { emoji: '🦂', keywords: ['scorpion'] },
    { emoji: '🐢', keywords: ['turtle'] },
    { emoji: '🐍', keywords: ['snake'] },
    { emoji: '🦎', keywords: ['lizard'] },
    { emoji: '🦖', keywords: ['t-rex', 'dinosaur'] },
    { emoji: '🦕', keywords: ['sauropod', 'dinosaur'] },
    { emoji: '🐙', keywords: ['octopus'] },
    { emoji: '🦑', keywords: ['squid'] },
    { emoji: '🦐', keywords: ['shrimp'] },
    { emoji: '🦞', keywords: ['lobster'] },
    { emoji: '🦀', keywords: ['crab'] },
    { emoji: '🐡', keywords: ['blowfish'] },
    { emoji: '🐠', keywords: ['tropical', 'fish'] },
    { emoji: '🐟', keywords: ['fish'] },
    { emoji: '🐬', keywords: ['dolphin'] },
    { emoji: '🐳', keywords: ['spouting', 'whale'] },
    { emoji: '🐋', keywords: ['whale'] },
    { emoji: '🦈', keywords: ['shark'] },
    { emoji: '🐊', keywords: ['crocodile'] },

    // Food & Drink
    { emoji: '🍎', keywords: ['apple', 'fruit', 'red'] },
    { emoji: '🍐', keywords: ['pear', 'fruit'] },
    { emoji: '🍊', keywords: ['orange', 'fruit'] },
    { emoji: '🍋', keywords: ['lemon', 'fruit', 'sour'] },
    { emoji: '🍌', keywords: ['banana', 'fruit'] },
    { emoji: '🍉', keywords: ['watermelon', 'fruit'] },
    { emoji: '🍇', keywords: ['grapes', 'fruit'] },
    { emoji: '🍓', keywords: ['strawberry', 'fruit'] },
    { emoji: '🫐', keywords: ['blueberries', 'fruit'] },
    { emoji: '🍈', keywords: ['melon', 'fruit'] },
    { emoji: '🍒', keywords: ['cherries', 'fruit'] },
    { emoji: '🍑', keywords: ['peach', 'fruit'] },
    { emoji: '🥭', keywords: ['mango', 'fruit'] },
    { emoji: '🍍', keywords: ['pineapple', 'fruit'] },
    { emoji: '🥥', keywords: ['coconut', 'fruit'] },
    { emoji: '🥝', keywords: ['kiwi', 'fruit'] },
    { emoji: '🍅', keywords: ['tomato', 'vegetable'] },
    { emoji: '🍆', keywords: ['eggplant', 'vegetable'] },
    { emoji: '🥑', keywords: ['avocado', 'fruit'] },
    { emoji: '🥦', keywords: ['broccoli', 'vegetable'] },
    { emoji: '🥬', keywords: ['leafy', 'greens', 'vegetable'] },
    { emoji: '🥒', keywords: ['cucumber', 'vegetable'] },
    { emoji: '🌶️', keywords: ['hot', 'pepper', 'spicy'] },
    { emoji: '🫑', keywords: ['bell', 'pepper', 'vegetable'] },
    { emoji: '🌽', keywords: ['corn', 'vegetable'] },
    { emoji: '🥕', keywords: ['carrot', 'vegetable'] },
    { emoji: '🫒', keywords: ['olive'] },
    { emoji: '🧄', keywords: ['garlic'] },
    { emoji: '🧅', keywords: ['onion'] },
    { emoji: '🥔', keywords: ['potato', 'vegetable'] },
    { emoji: '🍠', keywords: ['roasted', 'sweet', 'potato'] },
    { emoji: '🥐', keywords: ['croissant', 'bread'] },
    { emoji: '🥯', keywords: ['bagel', 'bread'] },
    { emoji: '🍞', keywords: ['bread', 'loaf'] },
    { emoji: '🥖', keywords: ['baguette', 'bread'] },
    { emoji: '🥨', keywords: ['pretzel'] },
    { emoji: '🧀', keywords: ['cheese'] },
    { emoji: '🥚', keywords: ['egg'] },
    { emoji: '🍳', keywords: ['cooking', 'egg', 'fried'] },
    { emoji: '🧈', keywords: ['butter'] },
    { emoji: '🥞', keywords: ['pancakes'] },
    { emoji: '🧇', keywords: ['waffle'] },
    { emoji: '🥓', keywords: ['bacon'] },
    { emoji: '🥩', keywords: ['cut', 'meat'] },
    { emoji: '🍗', keywords: ['poultry', 'leg', 'chicken'] },
    { emoji: '🍖', keywords: ['meat', 'bone'] },
    { emoji: '🦴', keywords: ['bone'] },
    { emoji: '🌭', keywords: ['hot', 'dog'] },
    { emoji: '🍔', keywords: ['hamburger', 'burger'] },
    { emoji: '🍟', keywords: ['french', 'fries'] },
    { emoji: '🍕', keywords: ['pizza'] },
    { emoji: '🥪', keywords: ['sandwich'] },
    { emoji: '🥙', keywords: ['stuffed', 'flatbread'] },
    { emoji: '🧆', keywords: ['falafel'] },
    { emoji: '🌮', keywords: ['taco'] },
    { emoji: '🌯', keywords: ['burrito'] },
    { emoji: '🫔', keywords: ['tamale'] },
    { emoji: '🥗', keywords: ['green', 'salad'] },
    { emoji: '🥘', keywords: ['shallow', 'pan', 'food'] },
    { emoji: '🫕', keywords: ['fondue'] },
    { emoji: '🥫', keywords: ['canned', 'food'] },
    { emoji: '🍝', keywords: ['spaghetti', 'pasta'] },
    { emoji: '🍜', keywords: ['steaming', 'bowl', 'ramen'] },
    { emoji: '🍲', keywords: ['pot', 'food', 'stew'] },
    { emoji: '🍛', keywords: ['curry', 'rice'] },
    { emoji: '🍣', keywords: ['sushi'] },
    { emoji: '🍱', keywords: ['bento', 'box'] },
    { emoji: '🥟', keywords: ['dumpling'] },
    { emoji: '🦪', keywords: ['oyster'] },
    { emoji: '🍤', keywords: ['fried', 'shrimp'] },
    { emoji: '🍙', keywords: ['rice', 'ball'] },
    { emoji: '🍚', keywords: ['cooked', 'rice'] },
    { emoji: '🍘', keywords: ['rice', 'cracker'] },
    { emoji: '🍥', keywords: ['fish', 'cake', 'swirl'] },
    { emoji: '🥠', keywords: ['fortune', 'cookie'] },
    { emoji: '🥮', keywords: ['moon', 'cake'] },
    { emoji: '🍢', keywords: ['oden'] },
    { emoji: '🍡', keywords: ['dango'] },
    { emoji: '🍧', keywords: ['shaved', 'ice'] },
    { emoji: '🍨', keywords: ['ice', 'cream'] },
    { emoji: '🍦', keywords: ['soft', 'ice', 'cream'] },
    { emoji: '🍰', keywords: ['shortcake', 'cake'] },
    { emoji: '🧁', keywords: ['cupcake'] },
    { emoji: '🥧', keywords: ['pie'] },
    { emoji: '🍮', keywords: ['custard'] },
    { emoji: '🍭', keywords: ['lollipop', 'candy'] },
    { emoji: '🍬', keywords: ['candy', 'sweet'] },
    { emoji: '🍫', keywords: ['chocolate', 'bar'] },
    { emoji: '🍿', keywords: ['popcorn'] },
    { emoji: '🍪', keywords: ['cookie'] },
    { emoji: '🌰', keywords: ['chestnut'] },
    { emoji: '🥜', keywords: ['peanuts', 'nuts'] },
    { emoji: '🍯', keywords: ['honey', 'pot'] },
    { emoji: '🥛', keywords: ['glass', 'milk'] },
    { emoji: '🍼', keywords: ['baby', 'bottle'] },
    { emoji: '🫖', keywords: ['teapot'] },

    // Activities & Objects
    { emoji: '⚽', keywords: ['soccer', 'ball', 'football'] },
    { emoji: '🏀', keywords: ['basketball'] },
    { emoji: '🏈', keywords: ['american', 'football'] },
    { emoji: '⚾', keywords: ['baseball'] },
    { emoji: '🥎', keywords: ['softball'] },
    { emoji: '🎾', keywords: ['tennis'] },
    { emoji: '🏐', keywords: ['volleyball'] },
    { emoji: '🏉', keywords: ['rugby', 'football'] },
    { emoji: '🥏', keywords: ['flying', 'disc', 'frisbee'] },
    { emoji: '🎱', keywords: ['pool', '8', 'ball'] },
    { emoji: '🪀', keywords: ['yo-yo'] },
    { emoji: '🏓', keywords: ['ping', 'pong', 'table', 'tennis'] },
    { emoji: '🏸', keywords: ['badminton'] },
    { emoji: '🏒', keywords: ['ice', 'hockey'] },
    { emoji: '🏑', keywords: ['field', 'hockey'] },
    { emoji: '🥍', keywords: ['lacrosse'] },
    { emoji: '🏏', keywords: ['cricket'] },
    { emoji: '🥅', keywords: ['goal', 'net'] },
    { emoji: '⛳', keywords: ['flag', 'hole', 'golf'] },
    { emoji: '🪁', keywords: ['kite'] },
    { emoji: '🏹', keywords: ['bow', 'arrow'] },
    { emoji: '🎣', keywords: ['fishing', 'pole'] },
    { emoji: '🤿', keywords: ['diving', 'mask'] },
    { emoji: '🥊', keywords: ['boxing', 'glove'] },
    { emoji: '🥋', keywords: ['martial', 'arts', 'uniform'] },
    { emoji: '🎽', keywords: ['running', 'shirt'] },
    { emoji: '🛹', keywords: ['skateboard'] },
    { emoji: '🛷', keywords: ['sled'] },
    { emoji: '⛸️', keywords: ['ice', 'skate'] },
    { emoji: '🥌', keywords: ['curling', 'stone'] },
    { emoji: '🎿', keywords: ['skis'] },
    { emoji: '⛷️', keywords: ['skier'] },
    { emoji: '🏂', keywords: ['snowboarder'] },
    { emoji: '🪂', keywords: ['parachute'] },
    { emoji: '🎭', keywords: ['performing', 'arts', 'theater'] },
    { emoji: '🩰', keywords: ['ballet', 'shoes'] },
    { emoji: '🎨', keywords: ['artist', 'palette', 'art'] },
    { emoji: '🎬', keywords: ['clapper', 'board', 'movie'] },
    { emoji: '🎤', keywords: ['microphone', 'singing'] },
    { emoji: '🎧', keywords: ['headphone', 'music'] },
    { emoji: '🎼', keywords: ['musical', 'score'] },
    { emoji: '🎹', keywords: ['musical', 'keyboard', 'piano'] },
    { emoji: '🥁', keywords: ['drum'] },
    { emoji: '🪘', keywords: ['long', 'drum'] },
    { emoji: '🎷', keywords: ['saxophone'] },
    { emoji: '🎺', keywords: ['trumpet'] },
    { emoji: '🎸', keywords: ['guitar'] },
    { emoji: '🪕', keywords: ['banjo'] },
    { emoji: '🎻', keywords: ['violin'] },
    { emoji: '🎲', keywords: ['game', 'die', 'dice'] },
    { emoji: '♟️', keywords: ['chess', 'pawn'] },
    { emoji: '🎯', keywords: ['direct', 'hit', 'target'] },
    { emoji: '🎳', keywords: ['bowling'] },
    { emoji: '🎮', keywords: ['video', 'game', 'controller'] },
    { emoji: '🎰', keywords: ['slot', 'machine'] },
    { emoji: '🧩', keywords: ['puzzle', 'piece'] },
    { emoji: '📱', keywords: ['mobile', 'phone', 'cell'] },

    // Travel & Places
    { emoji: '🚗', keywords: ['automobile', 'car'] },
    { emoji: '🚕', keywords: ['taxi'] },
    { emoji: '🚙', keywords: ['sport', 'utility', 'vehicle', 'suv'] },
    { emoji: '🚌', keywords: ['bus'] },
    { emoji: '🚎', keywords: ['trolleybus'] },
    { emoji: '🏎️', keywords: ['racing', 'car'] },
    { emoji: '🚓', keywords: ['police', 'car'] },
    { emoji: '🚑', keywords: ['ambulance'] },
    { emoji: '🚒', keywords: ['fire', 'engine'] },
    { emoji: '🚐', keywords: ['minibus'] },
    { emoji: '🚚', keywords: ['delivery', 'truck'] },
    { emoji: '🚛', keywords: ['articulated', 'lorry'] },
    { emoji: '🚜', keywords: ['tractor'] },
    { emoji: '🛴', keywords: ['kick', 'scooter'] },
    { emoji: '🛵', keywords: ['motor', 'scooter'] },
    { emoji: '🏍️', keywords: ['motorcycle'] },
    { emoji: '🚨', keywords: ['police', 'car', 'light'] },
    { emoji: '🚔', keywords: ['oncoming', 'police', 'car'] },
    { emoji: '🚍', keywords: ['oncoming', 'bus'] },
    { emoji: '🚘', keywords: ['oncoming', 'automobile'] },
    { emoji: '🚖', keywords: ['oncoming', 'taxi'] },
    { emoji: '🚡', keywords: ['aerial', 'tramway'] },
    { emoji: '🚠', keywords: ['mountain', 'cableway'] },
    { emoji: '🚟', keywords: ['suspension', 'railway'] },
    { emoji: '🚃', keywords: ['railway', 'car'] },
    { emoji: '🚋', keywords: ['tram', 'car'] },
    { emoji: '🚞', keywords: ['mountain', 'railway'] },
    { emoji: '🚝', keywords: ['monorail'] },
    { emoji: '🚄', keywords: ['high-speed', 'train'] },
    { emoji: '🚅', keywords: ['bullet', 'train'] },
    { emoji: '🚈', keywords: ['light', 'rail'] },
    { emoji: '🚂', keywords: ['locomotive'] },
    { emoji: '🚆', keywords: ['train'] },
    { emoji: '🚇', keywords: ['metro', 'subway'] },
    { emoji: '🚊', keywords: ['tram'] },
    { emoji: '🚉', keywords: ['station'] },
    { emoji: '✈️', keywords: ['airplane', 'plane', 'flight'] },
    { emoji: '🛫', keywords: ['airplane', 'departure'] },
    { emoji: '🛬', keywords: ['airplane', 'arrival'] },
    { emoji: '🛩️', keywords: ['small', 'airplane'] },
    { emoji: '💺', keywords: ['seat'] },
    { emoji: '🛰️', keywords: ['satellite'] },
    { emoji: '🚀', keywords: ['rocket', 'space'] },
    { emoji: '🛸', keywords: ['flying', 'saucer', 'ufo'] },
    { emoji: '🚁', keywords: ['helicopter'] },
    { emoji: '🛶', keywords: ['canoe'] },
    { emoji: '⛵', keywords: ['sailboat'] },
    { emoji: '🚤', keywords: ['speedboat'] },
    { emoji: '🛥️', keywords: ['motor', 'boat'] },
    { emoji: '🛳️', keywords: ['passenger', 'ship'] },
    { emoji: '⛴️', keywords: ['ferry'] },
    { emoji: '🚢', keywords: ['ship'] },
    { emoji: '⚓', keywords: ['anchor'] },
    { emoji: '🚧', keywords: ['construction'] },
    { emoji: '⛽', keywords: ['fuel', 'pump', 'gas'] },
    { emoji: '🚏', keywords: ['bus', 'stop'] },
    { emoji: '🚦', keywords: ['vertical', 'traffic', 'light'] },
    { emoji: '🚥', keywords: ['horizontal', 'traffic', 'light'] },
    { emoji: '🗺️', keywords: ['world', 'map'] },
    { emoji: '🗿', keywords: ['moai', 'statue'] },
    { emoji: '🗽', keywords: ['statue', 'liberty'] },
    { emoji: '🗼', keywords: ['tokyo', 'tower'] },
    { emoji: '🏰', keywords: ['castle'] },
    { emoji: '🏯', keywords: ['japanese', 'castle'] },
    { emoji: '🏟️', keywords: ['stadium'] },
    { emoji: '🎡', keywords: ['ferris', 'wheel'] },
    { emoji: '🎢', keywords: ['roller', 'coaster'] },
    { emoji: '🎠', keywords: ['carousel', 'horse'] },
    { emoji: '⛲', keywords: ['fountain'] },
    { emoji: '⛱️', keywords: ['umbrella', 'beach'] },
    { emoji: '🏖️', keywords: ['beach', 'umbrella'] },
    { emoji: '🏝️', keywords: ['desert', 'island'] },
    { emoji: '🏔️', keywords: ['snow-capped', 'mountain'] },
    { emoji: '🗻', keywords: ['mount', 'fuji'] },
    { emoji: '🌋', keywords: ['volcano'] },
    { emoji: '🗾', keywords: ['map', 'japan'] },
    { emoji: '🏕️', keywords: ['camping'] },
    { emoji: '⛺', keywords: ['tent'] },
    { emoji: '🏠', keywords: ['house'] },
    { emoji: '🏡', keywords: ['house', 'garden'] },
    { emoji: '🏘️', keywords: ['houses'] },
    { emoji: '🏚️', keywords: ['derelict', 'house'] },
    { emoji: '🏗️', keywords: ['building', 'construction'] },
    { emoji: '🏭', keywords: ['factory'] },
    { emoji: '🏢', keywords: ['office', 'building'] },
    { emoji: '🏬', keywords: ['department', 'store'] },
    { emoji: '🏣', keywords: ['japanese', 'post', 'office'] },
    { emoji: '🏤', keywords: ['post', 'office'] },
    { emoji: '🏥', keywords: ['hospital'] },
    { emoji: '🏦', keywords: ['bank'] },
    { emoji: '🏨', keywords: ['hotel'] },
    { emoji: '🏪', keywords: ['convenience', 'store'] },
    { emoji: '🏫', keywords: ['school'] },
    { emoji: '🏩', keywords: ['love', 'hotel'] },
    { emoji: '💒', keywords: ['wedding'] },
    { emoji: '⛪', keywords: ['church'] },

    // Symbols & Objects
    { emoji: '❤️', keywords: ['red', 'heart', 'love'] },
    { emoji: '🧡', keywords: ['orange', 'heart', 'love'] },
    { emoji: '💛', keywords: ['yellow', 'heart', 'love'] },
    { emoji: '💚', keywords: ['green', 'heart', 'love'] },
    { emoji: '💙', keywords: ['blue', 'heart', 'love'] },
    { emoji: '💜', keywords: ['purple', 'heart', 'love'] },
    { emoji: '🖤', keywords: ['black', 'heart', 'love'] },
    { emoji: '🤍', keywords: ['white', 'heart', 'love'] },
    { emoji: '🤎', keywords: ['brown', 'heart', 'love'] },
    { emoji: '💔', keywords: ['broken', 'heart', 'sad'] },
    { emoji: '❣️', keywords: ['heavy', 'heart', 'exclamation'] },
    { emoji: '💕', keywords: ['two', 'hearts', 'love'] },
    { emoji: '💞', keywords: ['revolving', 'hearts', 'love'] },
    { emoji: '💓', keywords: ['beating', 'heart', 'love'] },
    { emoji: '💗', keywords: ['growing', 'heart', 'love'] },
    { emoji: '💖', keywords: ['sparkling', 'heart', 'love'] },
    { emoji: '💘', keywords: ['heart', 'arrow', 'cupid'] },
    { emoji: '💝', keywords: ['heart', 'ribbon', 'gift'] },
    { emoji: '💟', keywords: ['heart', 'decoration'] },
    { emoji: '☮️', keywords: ['peace', 'symbol'] },
    { emoji: '✝️', keywords: ['latin', 'cross'] },
    { emoji: '☪️', keywords: ['star', 'crescent'] },
    { emoji: '🕉️', keywords: ['om'] },
    { emoji: '☸️', keywords: ['wheel', 'dharma'] },
    { emoji: '✡️', keywords: ['star', 'david'] },
    { emoji: '🔯', keywords: ['dotted', 'six-pointed', 'star'] },
    { emoji: '🕎', keywords: ['menorah'] },
    { emoji: '☯️', keywords: ['yin', 'yang'] },
    { emoji: '☦️', keywords: ['orthodox', 'cross'] },
    { emoji: '🛐', keywords: ['place', 'worship'] },
    { emoji: '⛎', keywords: ['ophiuchus'] },
    { emoji: '♈', keywords: ['aries'] },
    { emoji: '♉', keywords: ['taurus'] },
    { emoji: '♊', keywords: ['gemini'] },
    { emoji: '♋', keywords: ['cancer'] },
    { emoji: '♌', keywords: ['leo'] },
    { emoji: '♍', keywords: ['virgo'] },
    { emoji: '♎', keywords: ['libra'] },
    { emoji: '♏', keywords: ['scorpio'] },
    { emoji: '♐', keywords: ['sagittarius'] },
    { emoji: '♑', keywords: ['capricorn'] },
    { emoji: '♒', keywords: ['aquarius'] },
    { emoji: '♓', keywords: ['pisces'] },
    { emoji: '🆔', keywords: ['id', 'button'] },
    { emoji: '⚛️', keywords: ['atom', 'symbol'] },
    { emoji: '🉑', keywords: ['japanese', 'acceptable'] },
    { emoji: '☢️', keywords: ['radioactive'] },
    { emoji: '☣️', keywords: ['biohazard'] },
    { emoji: '📴', keywords: ['mobile', 'phone', 'off'] },
    { emoji: '📳', keywords: ['vibration', 'mode'] },
    { emoji: '🈶', keywords: ['japanese', 'not', 'free', 'charge'] },
    { emoji: '🈚', keywords: ['japanese', 'free', 'charge'] },
    { emoji: '🈸', keywords: ['japanese', 'application'] },
    { emoji: '🈺', keywords: ['japanese', 'open', 'business'] },
    { emoji: '🈷️', keywords: ['japanese', 'monthly', 'amount'] },
    { emoji: '✴️', keywords: ['eight-pointed', 'star'] },
    { emoji: '🆚', keywords: ['vs', 'button'] },
    { emoji: '💮', keywords: ['white', 'flower'] },
    { emoji: '🉐', keywords: ['japanese', 'bargain'] },
    { emoji: '㊙️', keywords: ['japanese', 'secret'] },
    { emoji: '㊗️', keywords: ['japanese', 'congratulations'] },
    { emoji: '🈴', keywords: ['japanese', 'passing', 'grade'] },
    { emoji: '🈵', keywords: ['japanese', 'no', 'vacancy'] },
    { emoji: '🈹', keywords: ['japanese', 'discount'] },
    { emoji: '🈲', keywords: ['japanese', 'prohibited'] },
    { emoji: '🅰️', keywords: ['a', 'button', 'blood', 'type'] },
    { emoji: '🅱️', keywords: ['b', 'button', 'blood', 'type'] },
    { emoji: '🆎', keywords: ['ab', 'button', 'blood', 'type'] },
    { emoji: '🆑', keywords: ['cl', 'button'] },
    { emoji: '🅾️', keywords: ['o', 'button', 'blood', 'type'] },
    { emoji: '🆘', keywords: ['sos', 'button'] },
    { emoji: '❌', keywords: ['cross', 'mark', 'no', 'x'] },
    { emoji: '⭕', keywords: ['heavy', 'large', 'circle'] },
    { emoji: '🛑', keywords: ['stop', 'sign'] },
    { emoji: '⛔', keywords: ['no', 'entry'] },
    { emoji: '📛', keywords: ['name', 'badge'] },
    { emoji: '🚫', keywords: ['prohibited'] },
    { emoji: '💯', keywords: ['hundred', 'points', 'perfect'] },
    { emoji: '💢', keywords: ['anger', 'symbol'] },
    { emoji: '♨️', keywords: ['hot', 'springs'] },
    { emoji: '🚷', keywords: ['no', 'pedestrians'] },
    { emoji: '🚯', keywords: ['no', 'littering'] },
    { emoji: '🚳', keywords: ['no', 'bicycles'] },
    { emoji: '🚱', keywords: ['non-potable', 'water'] },
    { emoji: '🔞', keywords: ['no', 'one', 'under', 'eighteen'] },
    { emoji: '📵', keywords: ['no', 'mobile', 'phones'] },
    { emoji: '🚭', keywords: ['no', 'smoking'] },
    { emoji: '❗', keywords: ['exclamation', 'mark'] },
    { emoji: '❕', keywords: ['white', 'exclamation', 'mark'] },
    { emoji: '❓', keywords: ['question', 'mark'] },
    { emoji: '❔', keywords: ['white', 'question', 'mark'] },
    { emoji: '‼️', keywords: ['double', 'exclamation', 'mark'] },
    { emoji: '⁉️', keywords: ['exclamation', 'question', 'mark'] },
    { emoji: '🔅', keywords: ['dim', 'button'] },
    { emoji: '🔆', keywords: ['bright', 'button'] },
    { emoji: '〽️', keywords: ['part', 'alternation', 'mark'] },

    // Flags & Misc
    { emoji: '🏁', keywords: ['chequered', 'flag', 'racing'] },
    { emoji: '🚩', keywords: ['triangular', 'flag'] },
    { emoji: '🎌', keywords: ['crossed', 'flags'] },
    { emoji: '🏴', keywords: ['black', 'flag'] },
    { emoji: '🏳️', keywords: ['white', 'flag'] },
    { emoji: '🏳️‍🌈', keywords: ['rainbow', 'flag', 'pride'] },
    { emoji: '🏴‍☠️', keywords: ['pirate', 'flag'] },
    { emoji: '🎉', keywords: ['party', 'popper', 'celebration'] },
    { emoji: '🎊', keywords: ['confetti', 'ball', 'celebration'] },
    { emoji: '🎈', keywords: ['balloon', 'party'] },
    { emoji: '🎂', keywords: ['birthday', 'cake'] },
    { emoji: '🎁', keywords: ['wrapped', 'gift', 'present'] },
    { emoji: '🎄', keywords: ['christmas', 'tree'] },
    { emoji: '🎃', keywords: ['jack-o-lantern', 'halloween'] },
    { emoji: '🎗️', keywords: ['reminder', 'ribbon'] },
    { emoji: '🎟️', keywords: ['admission', 'tickets'] },
    { emoji: '🎫', keywords: ['ticket'] },
    { emoji: '🎖️', keywords: ['military', 'medal'] },
    { emoji: '🏆', keywords: ['trophy', 'winner'] },
    { emoji: '🏅', keywords: ['sports', 'medal'] },
    { emoji: '🥇', keywords: ['1st', 'place', 'medal', 'gold'] },
    { emoji: '🥈', keywords: ['2nd', 'place', 'medal', 'silver'] },
    { emoji: '🥉', keywords: ['3rd', 'place', 'medal', 'bronze'] },
    { emoji: '🔥', keywords: ['fire', 'hot', 'lit'] },
    { emoji: '💯', keywords: ['hundred', 'points', 'perfect', '100'] },
    { emoji: '✨', keywords: ['sparkles', 'magic', 'shiny'] },
    { emoji: '🌟', keywords: ['glowing', 'star'] },
    { emoji: '💫', keywords: ['dizzy'] },
    { emoji: '⭐', keywords: ['star'] },
    { emoji: '💥', keywords: ['collision', 'explosion'] },
    { emoji: '⚡', keywords: ['high', 'voltage', 'lightning'] },
    { emoji: '💦', keywords: ['sweat', 'droplets'] },
    { emoji: '💨', keywords: ['dashing', 'away', 'wind'] },
    { emoji: '☁️', keywords: ['cloud'] },
    { emoji: '🌤️', keywords: ['sun', 'behind', 'small', 'cloud'] },
    { emoji: '⛅', keywords: ['sun', 'behind', 'cloud'] },
    { emoji: '🌥️', keywords: ['sun', 'behind', 'large', 'cloud'] },
    { emoji: '🌦️', keywords: ['sun', 'behind', 'rain', 'cloud'] },
    { emoji: '🌧️', keywords: ['cloud', 'rain'] },
    { emoji: '⛈️', keywords: ['cloud', 'lightning', 'rain'] },
    { emoji: '🌩️', keywords: ['cloud', 'lightning'] },
    { emoji: '🌨️', keywords: ['cloud', 'snow'] },
    { emoji: '☃️', keywords: ['snowman'] },
    { emoji: '⛄', keywords: ['snowman', 'without', 'snow'] },
    { emoji: '🌬️', keywords: ['wind', 'face'] },
    { emoji: '🌪️', keywords: ['tornado'] },
    { emoji: '🌫️', keywords: ['fog'] },
    { emoji: '🌊', keywords: ['water', 'wave'] },
    { emoji: '💧', keywords: ['droplet', 'water'] },
    { emoji: '☔', keywords: ['umbrella', 'rain', 'drops'] },
    { emoji: '☂️', keywords: ['umbrella'] },
    { emoji: '🌂', keywords: ['closed', 'umbrella'] }
  ];

  // Filter emojis based on search term
  const getFilteredEmojis = (searchTerm) => {
    if (!searchTerm.trim()) {
      return emojiData.map(item => item.emoji);
    }

    const lowercaseSearch = searchTerm.toLowerCase();
    return emojiData
      .filter(item =>
        item.keywords.some(keyword =>
          keyword.toLowerCase().includes(lowercaseSearch)
        )
      )
      .map(item => item.emoji);
  };

  // Export chat modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportAppointment, setExportAppointment] = useState(null);
  const [exportComments, setExportComments] = useState([]);
  const [exportCallHistory, setExportCallHistory] = useState([]);

  // Call History modal state
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);
  const [callHistoryAppointmentId, setCallHistoryAppointmentId] = useState(null);

  // Lock body scroll when admin action modals are open (cancel, reinitiate, archive, unarchive)
  useEffect(() => {
    const shouldLock = showCancelModal || showReinitiateModal || showArchiveModal || showUnarchiveModal;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCancelModal, showReinitiateModal, showArchiveModal, showUnarchiveModal]);

  // Close audio menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-audio-menu]') &&
        !event.target.closest('[data-audio-speed-menu]') &&
        !event.target.closest('[data-audio-controls-menu]') &&
        !event.target.closest('button[title="Audio options"]')) {
        document.querySelectorAll('[data-audio-menu]').forEach(menu => {
          menu.classList.add('hidden');
        });
        document.querySelectorAll('[data-audio-speed-menu]').forEach(menu => {
          menu.classList.add('hidden');
        });
        document.querySelectorAll('[data-audio-controls-menu]').forEach(menu => {
          menu.classList.add('hidden');
        });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Handle direct chat link via URL parameter
  const chatRouteResolvedRef = useRef(null);

  useEffect(() => {
    const chatIdFromUrl = params.chatId;

    if (!chatIdFromUrl) {
      chatRouteResolvedRef.current = null;
      setMissingChatbookError(null);
      return;
    }

    setMissingChatbookError(null);

    if (chatRouteResolvedRef.current === chatIdFromUrl) {
      return;
    }

    let cancelled = false;

    const openChatForAppointment = (appointment) => {
      if (!appointment || cancelled) return;
      chatRouteResolvedRef.current = appointment._id;
      setShouldOpenChatFromNotification(true);
      setActiveChatAppointmentId(appointment._id);
      setMissingChatbookError(null);
    };

    const resolveChatRoute = async () => {
      // 1. Try local find
      const findLocalAppointment = () =>
        appointments.find((appt) => appt._id === chatIdFromUrl) ||
        allAppointments.find((appt) => appt._id === chatIdFromUrl) ||
        archivedAppointments.find((appt) => appt._id === chatIdFromUrl);

      let appointment = findLocalAppointment();
      if (appointment) {
        openChatForAppointment(appointment);
        return;
      }

      // 2. Fallback to API fetch
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${chatIdFromUrl}`);

        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) setMissingChatbookError(chatIdFromUrl);
            return;
          }
          throw new Error('Failed to fetch appointment details');
        }

        const data = await response.json();
        appointment = data.booking || data;

        if (!appointment?._id) {
          throw new Error('Invalid appointment payload');
        }

        // Add to state if missing
        if (!cancelled) {
          setAllAppointments((prev) => {
            const exists = prev.some(a => a._id === appointment._id);
            if (exists) return prev;
            return [appointment, ...prev];
          });
          openChatForAppointment(appointment);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to resolve chat via link:', error);
          setMissingChatbookError(chatIdFromUrl);
        }
      }
    };

    resolveChatRoute();

    return () => {
      cancelled = true;
    };
  }, [params.chatId, appointments, allAppointments, archivedAppointments]);

  // Add state to track updated comments for each appointment
  // REMOVED: updatedComments state - no longer needed, using appointments array directly

  // Add ref to prevent infinite loops in comment updates
  const isUpdatingCommentsRef = useRef(false);

  // Function to update comments for a specific appointment
  const updateAppointmentComments = useCallback((appointmentId, comments) => {
    // Prevent infinite loops
    if (isUpdatingCommentsRef.current) {
      return;
    }

    // CRITICAL FIX: Update appointments array directly instead of separate updatedComments state
    setAppointments(prev => {
      const updated = prev.map(appt => {
        if (appt._id === appointmentId) {
          // Only update if there are actual changes
          if (JSON.stringify(appt.comments) !== JSON.stringify(comments)) {
            // Set flag to prevent infinite loops
            isUpdatingCommentsRef.current = true;

            // Reset flag after a short delay
            setTimeout(() => {
              isUpdatingCommentsRef.current = false;
            }, 100);

            return { ...appt, comments };
          }
        }
        return appt;
      });
      return updated;
    });

    // CRITICAL FIX: Also update main allAppointments state to ensure persistence across filtering/pagination
    setAllAppointments(prev => {
      const updated = prev.map(appt => {
        if (appt._id === appointmentId) {
          // Only update if there are actual changes
          if (JSON.stringify(appt.comments) !== JSON.stringify(comments)) {
            return { ...appt, comments };
          }
        }
        return appt;
      });
      return updated;
    });

    // Also update archived appointments if needed
    setArchivedAppointments(prev => {
      const updated = prev.map(appt => {
        if (appt._id === appointmentId) {
          // Only update if there are actual changes
          if (JSON.stringify(appt.comments) !== JSON.stringify(comments)) {
            return { ...appt, comments };
          }
        }
        return appt;
      });
      return updated;
    });
  }, []);

  // Define fetch functions outside useEffect so they can be used in socket handlers
  const fetchAppointments = useCallback(async () => {
    try {
      // Fetch all appointments without pagination
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      const data = await res.json();
      const allAppts = data.appointments || data;
      setAllAppointments(allAppts);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
      setLoading(false);
    }
  }, []);

  const fetchArchivedAppointments = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/archived`);
      if (!res.ok) throw new Error('Failed to fetch archived appointments');
      const data = await res.json();
      setArchivedAppointments(data);
    } catch (err) {
      console.error("Failed to fetch archived appointments", err);
    }
  }, []);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // Join admin appointments room to receive real-time updates
    if (socket.connected && currentUser) {
      socket.emit('adminAppointmentsActive', {
        adminId: currentUser._id,
        role: currentUser.role
      });
    }

    // Emit adminAppointmentsActive periodically to stay subscribed (reduced frequency)
    const adminInterval = setInterval(() => {
      if (currentUser) {
        socket.emit('adminAppointmentsActive', {
          adminId: currentUser._id,
          role: currentUser.role
        });
      }
    }, 30000); // Changed from 1000ms to 30000ms (30 seconds)

    fetchAppointments();
    fetchArchivedAppointments();
    // Removed periodic refresh interval - appointments are updated via socket events in real-time
    // No need to poll every 5 seconds, which was causing unnecessary message refreshes in chatbox
    // Real-time updates are handled by socket events (commentUpdate, appointmentUpdate, etc.)

    // Helper function to update appointment with new profile data
    const getProfileUpdatedAppointment = (appt, profileData) => {
      let updated = { ...appt };
      let hasChanges = false;

      // Update buyer info
      if (appt.buyerId && (appt.buyerId._id === profileData.userId || appt.buyerId === profileData.userId)) {
        updated.buyerId = {
          ...updated.buyerId,
          username: profileData.username,
          email: profileData.email,
          mobileNumber: profileData.mobileNumber,
          avatar: profileData.avatar
        };
        hasChanges = true;
      }

      // Update seller info
      if (appt.sellerId && (appt.sellerId._id === profileData.userId || appt.sellerId === profileData.userId)) {
        updated.sellerId = {
          ...updated.sellerId,
          username: profileData.username,
          email: profileData.email,
          mobileNumber: profileData.mobileNumber,
          avatar: profileData.avatar
        };
        hasChanges = true;
      }

      return hasChanges ? updated : null;
    };

    // Listen for profile updates to update user info in appointments
    const handleProfileUpdate = (profileData) => {
      const updateList = (prevList) => prevList.map(appt => {
        const updated = getProfileUpdatedAppointment(appt, profileData);
        return updated || appt;
      });

      setAppointments(updateList);
      setAllAppointments(updateList);
      setArchivedAppointments(updateList);
    };
    socket.on('profileUpdated', handleProfileUpdate);

    // Helper function to update appointment with new comment
    const getCommentUpdatedAppointment = (appt, data) => {
      if (appt._id !== data.appointmentId) return null;

      const existingCommentIndex = appt.comments?.findIndex(c => c._id === data.comment._id);
      if (existingCommentIndex !== -1) {
        // Update existing comment - only if there are actual changes
        // and preserve starred status and media URLs for deleted messages
        const existingComment = appt.comments[existingCommentIndex];
        const updatedComment = {
          ...data.comment,
          starredBy: existingComment.starredBy || [],
          // Preserve media URLs if the message is being deleted and they're not in the update
          videoUrl: data.comment.videoUrl || existingComment.videoUrl,
          audioUrl: data.comment.audioUrl || existingComment.audioUrl,
          audioName: data.comment.audioName || existingComment.audioName,
          documentUrl: data.comment.documentUrl || existingComment.documentUrl,
          documentName: data.comment.documentName || existingComment.documentName,
          originalImageUrl: data.comment.originalImageUrl || existingComment.originalImageUrl || existingComment.imageUrl,
          imageUrl: data.comment.imageUrl || existingComment.imageUrl
        };

        if (JSON.stringify(existingComment) !== JSON.stringify(updatedComment)) {
          const updatedComments = [...(appt.comments || [])];
          updatedComments[existingCommentIndex] = updatedComment;
          return { ...appt, comments: updatedComments };
        }
        return null; // No changes needed
      } else {
        // Add new comment
        const updatedComments = [...(appt.comments || []), data.comment];
        return { ...appt, comments: updatedComments };
      }
    };

    // Listen for real-time comment updates to refresh appointments
    const handleCommentUpdate = (data) => {
      // Skip handling if this is a message sent by current admin user to prevent duplicates
      // Admin messages are already added locally in handleCommentSend
      if (data.comment.senderEmail?.toLowerCase() === currentUser?.email?.toLowerCase()) {
        return;
      }

      // Consolidated update logic to prevent duplication and ensure consistency
      const updateListWithSound = (prevList) => prevList.map(appt => {
        const updated = getCommentUpdatedAppointment(appt, data);
        if (updated) {
          try {
            if (settings.soundEnabled) playMessageReceived();
          } catch (_) { }
          return updated;
        }
        return appt;
      });

      const updateListSilent = (prevList) => prevList.map(appt => {
        const updated = getCommentUpdatedAppointment(appt, data);
        return updated || appt;
      });

      // Update the specific appointment's comments in real-time
      setAppointments(updateListWithSound);

      // CRITICAL FIX: Also update allAppointments
      setAllAppointments(updateListSilent);

      // Also update archived appointments if needed
      setArchivedAppointments(updateListWithSound);

      // REMOVED: updatedComments state update that was causing race conditions
      // The appointments array is already updated above, no need for separate state
    };
    socket.on('commentUpdate', handleCommentUpdate);

    // Listen for chat cleared events
    const handleChatCleared = (data) => {
      setAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, comments: [] } : appt
        )
      );
      setAllAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, comments: [] } : appt
        )
      );
      setArchivedAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, comments: [] } : appt
        )
      );
    };
    socket.on('chatCleared', handleChatCleared);

    // Listen for appointment updates
    const handleAppointmentUpdate = (data) => {
      setAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, ...data.updatedAppointment } : appt
        )
      );
      setAllAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, ...data.updatedAppointment } : appt
        )
      );
      setArchivedAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, ...data.updatedAppointment } : appt
        )
      );
    };

    // Listen for payment status updates
    const handlePaymentStatusUpdate = (data) => {
      setAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, paymentConfirmed: data.paymentConfirmed } : appt
        )
      );
      setAllAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, paymentConfirmed: data.paymentConfirmed } : appt
        )
      );
      setArchivedAppointments(prev =>
        prev.map(appt =>
          appt._id === data.appointmentId ? { ...appt, paymentConfirmed: data.paymentConfirmed } : appt
        )
      );
    };

    socket.on('appointmentUpdate', handleAppointmentUpdate);
    socket.on('paymentStatusUpdated', handlePaymentStatusUpdate);

    // Listen for new appointments
    const handleAppointmentCreated = (data) => {
      const newAppt = data.appointment;
      setAppointments(prev => [newAppt, ...prev]);
      setAllAppointments(prev => [newAppt, ...prev]);
    };
    socket.on('appointmentCreated', handleAppointmentCreated);

    // Listen for socket connection events
    const handleConnect = () => {
      // Re-join admin appointments rooms on reconnect to receive real-time updates
      // The interval will handle periodic emissions, so we only emit once on reconnect
      if (currentUser) {
        socket.emit('adminAppointmentsActive', {
          adminId: currentUser._id,
          role: currentUser.role
        });
      }
    };
    const handleDisconnect = () => {
      // Socket disconnected - will auto-reconnect
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      // Interval removed - no cleanup needed
      clearInterval(adminInterval);
      socket.off('profileUpdated', handleProfileUpdate);
      socket.off('commentUpdate', handleCommentUpdate);
      socket.off('chatCleared', handleChatCleared);
      socket.off('appointmentUpdate', handleAppointmentUpdate);
      socket.off('paymentStatusUpdated', handlePaymentStatusUpdate);
      socket.off('appointmentCreated', handleAppointmentCreated);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchAppointments, fetchArchivedAppointments, currentUser?._id, settings.soundEnabled]);

  // Separate useEffect for pagination and filtering
  useEffect(() => {
    if (allAppointments.length === 0) return;

    // Apply filters
    let filteredAppts = allAppointments.filter((appt) => {
      const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const matchesStatus =
        statusFilter === "all" ? true :
          statusFilter === "outdated" ? isOutdated :
            appt.status === statusFilter;
      const matchesSearch =
        appt.buyerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.buyerId?.username?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.username?.toLowerCase().includes(search.toLowerCase()) ||
        appt.propertyName?.toLowerCase().includes(search.toLowerCase());
      const matchesDateRange =
        (!startDate || new Date(appt.date) >= new Date(startDate)) &&
        (!endDate || new Date(appt.date) <= new Date(endDate));

      return matchesStatus && matchesSearch && matchesDateRange;
    });

    // Calculate pagination
    // Calculate pagination
    const itemsPerPage = 10;

    // Auto-switch page if deep-linking to an appointment
    if (shouldOpenChatFromNotification && activeChatAppointmentId) {
      const index = filteredAppts.findIndex(a => a._id === activeChatAppointmentId);
      if (index !== -1) {
        const targetPage = Math.ceil((index + 1) / itemsPerPage);
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }
      }
    }

    const totalPages = Math.ceil(filteredAppts.length / itemsPerPage);
    setTotalPages(totalPages);

    // Get current page items
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageAppts = filteredAppts.slice(startIndex, endIndex);

    // IMPORTANT: Ensure active chat appointment is visible
    if (shouldOpenChatFromNotification && activeChatAppointmentId) {
      const appt = allAppointments.find(a => a._id === activeChatAppointmentId);
      if (appt) {
        const isPresent = currentPageAppts.some(a => a._id === activeChatAppointmentId);
        if (!isPresent) {
          currentPageAppts.unshift(appt);
        }
      }
    }

    setAppointments(currentPageAppts);
  }, [allAppointments, currentPage, search, statusFilter, startDate, endDate]);

  // Separate useEffect for archived appointments pagination and filtering
  useEffect(() => {
    if (archivedAppointments.length === 0) return;

    // Apply filters to archived appointments
    let filteredArchivedAppts = archivedAppointments.filter((appt) => {
      const isOutdated = new Date(appt.date) < new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && appt.time && appt.time < new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const matchesStatus =
        statusFilter === "all" ? true :
          statusFilter === "outdated" ? isOutdated :
            appt.status === statusFilter;
      const matchesSearch =
        appt.buyerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        appt.buyerId?.username?.toLowerCase().includes(search.toLowerCase()) ||
        appt.sellerId?.username?.toLowerCase().includes(search.toLowerCase()) ||
        appt.propertyName?.toLowerCase().includes(search.toLowerCase());
      const matchesDateRange =
        (!startDate || new Date(appt.date) >= new Date(startDate)) &&
        (!endDate || new Date(appt.date) <= new Date(endDate));

      return matchesStatus && matchesSearch && matchesDateRange;
    });

    // Calculate pagination for archived appointments
    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredArchivedAppts.length / itemsPerPage);
    setArchivedTotalPages(totalPages);

    // Get current page items for archived appointments
    const startIndex = (archivedCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageArchivedAppts = filteredArchivedAppts.slice(startIndex, endIndex);

    setFilteredArchivedAppointments(currentPageArchivedAppts);
  }, [archivedAppointments, archivedCurrentPage, search, statusFilter, startDate, endDate]);

  // Lock background scroll when user modal is open
  useEffect(() => {
    if (showUserModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showUserModal]);

  // Dynamically update user info in appointments when currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    const updateApptWithUser = (appt) => {
      const updated = { ...appt };
      let hasChanges = false;

      // Update buyer info if current user is the buyer
      if (appt.buyerId && (appt.buyerId._id === currentUser._id || appt.buyerId === currentUser._id)) {
        updated.buyerId = {
          ...updated.buyerId,
          username: currentUser.username,
          email: currentUser.email,
          mobileNumber: currentUser.mobileNumber,
          avatar: currentUser.avatar
        };
        hasChanges = true;
      }

      // Update seller info if current user is the seller
      if (appt.sellerId && (appt.sellerId._id === currentUser._id || appt.sellerId === currentUser._id)) {
        updated.sellerId = {
          ...updated.sellerId,
          username: currentUser.username,
          email: currentUser.email,
          mobileNumber: currentUser.mobileNumber,
          avatar: currentUser.avatar
        };
        hasChanges = true;
      }

      return hasChanges ? updated : appt;
    };

    setAppointments(prev => prev.map(updateApptWithUser));
    setAllAppointments(prev => prev.map(updateApptWithUser));
    setArchivedAppointments(prev => prev.map(updateApptWithUser));
  }, [currentUser]);

  const handleAdminCancel = async (id) => {
    setAppointmentToHandle(id);
    setCancelReason('');
    setShowCancelModal(true);
    // Close reactions bar when admin action modal opens
    setShowReactionsBar(false);
    setReactionsMessageId(null);
  };

  const confirmAdminCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancelling this appointment.');
      return;
    }

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: cancelReason })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      setAppointments((prev) =>
        prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "cancelledByAdmin", cancelReason: cancelReason } : appt))
      );
      setAllAppointments((prev) =>
        prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "cancelledByAdmin", cancelReason: cancelReason } : appt))
      );
      toast.success("Appointment cancelled successfully. Both buyer and seller have been notified of the cancellation.");

      // Close modal and reset state
      setShowCancelModal(false);
      setAppointmentToHandle(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error in confirmAdminCancel:', err);
      toast.error(err.response?.data?.message || "Failed to cancel appointment.");
    }
  };

  const handleReinitiateAppointment = async (id) => {
    // Fetch payment status to check if refunded
    let paymentStatus = null;
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?appointmentId=${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.payments && data.payments.length > 0) {
          paymentStatus = data.payments[0];
        }
      }
    } catch (error) {
      console.error('Error fetching payment status:', error);
    }

    setReinitiatePaymentStatus(paymentStatus);
    setAppointmentToHandle(id);
    setShowReinitiateModal(true);
    // Close reactions bar when admin action modal opens
    setShowReactionsBar(false);
    setReactionsMessageId(null);
  };

  const confirmReinitiate = async () => {
    // Get the appointment to check status
    const appt = appointments.find(a => a._id === appointmentToHandle);

    // Check if payment is refunded for cancelled appointment
    if (appt && (appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'cancelledByAdmin')) {
      if (reinitiatePaymentStatus && (reinitiatePaymentStatus.status === 'refunded' || reinitiatePaymentStatus.status === 'partially_refunded')) {
        toast.error('Reinitiation disabled: The buyer has already received a refund for this appointment.');
        setShowReinitiateModal(false);
        setAppointmentToHandle(null);
        setReinitiatePaymentStatus(null);
        return;
      }
    }

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/reinitiate`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      setAppointments((prev) =>
        prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "pending", cancelReason: "" } : appt))
      );
      setAllAppointments((prev) =>
        prev.map((appt) => (appt._id === appointmentToHandle ? { ...appt, status: "pending", cancelReason: "" } : appt))
      );
      toast.success("Appointment reinitiated successfully. Both buyer and seller have been notified.");

      // Close modal and reset state
      setShowReinitiateModal(false);
      setAppointmentToHandle(null);
      setReinitiatePaymentStatus(null);
    } catch (err) {
      console.error('Error in confirmReinitiate:', err);
      toast.error(err.response?.data?.message || "Failed to reinitiate appointment.");
    }
  };

  const handleArchiveAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowArchiveModal(true);
    // Close reactions bar when admin action modal opens
    setShowReactionsBar(false);
    setReactionsMessageId(null);
  };

  const confirmArchive = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      // Remove from active appointments and add to archived
      const archivedAppt = appointments.find(appt => appt._id === appointmentToHandle);
      if (archivedAppt) {
        setAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setAllAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setArchivedAppointments((prev) => [{ ...archivedAppt, archivedByAdmin: true, archivedAt: new Date() }, ...prev]);
      }
      toast.success("Appointment archived successfully.");

      // Close modal and reset state
      setShowArchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmArchive:', err);
      toast.error(err.response?.data?.message || "Failed to archive appointment.");
    }
  };

  const handleUnarchiveAppointment = async (id) => {
    setAppointmentToHandle(id);
    setShowUnarchiveModal(true);
    // Close reactions bar when admin action modal opens
    setShowReactionsBar(false);
    setReactionsMessageId(null);
  };

  const confirmUnarchive = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appointmentToHandle}/unarchive`, {
        method: 'PATCH',
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      // Remove from archived appointments and add back to active
      const unarchivedAppt = archivedAppointments.find(appt => appt._id === appointmentToHandle);
      if (unarchivedAppt) {
        setArchivedAppointments((prev) => prev.filter((appt) => appt._id !== appointmentToHandle));
        setAppointments((prev) => [{ ...unarchivedAppt, archivedByAdmin: false, archivedAt: undefined }, ...prev]);
        setAllAppointments((prev) => [{ ...unarchivedAppt, archivedByAdmin: false, archivedAt: undefined }, ...prev]);
      }
      toast.success("Appointment unarchived successfully.");

      // Close modal and reset state
      setShowUnarchiveModal(false);
      setAppointmentToHandle(null);
    } catch (err) {
      console.error('Error in confirmUnarchive:', err);
      toast.error(err.response?.data?.message || "Failed to unarchive appointment.");
    }
  };

  const handleUserClick = async (userId) => {
    if (!userId) {
      toast.error("User ID not available");
      return;
    }

    setUserLoading(true);
    setShowUserModal(true);
    // Close reactions bar when user modal opens
    setShowReactionsBar(false);
    setReactionsMessageId(null);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/id/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data);
      } else {
        throw new Error("Failed to fetch user");
      }
    } catch (err) {
      toast.error("Failed to fetch user details.");
      setShowUserModal(false);
    }
    setUserLoading(false);
  };

  // CRITICAL FIX: Use appointments directly since socket updates them in real-time
  // Remove the updatedComments override that was causing race conditions
  const appointmentsWithComments = appointments.map((appt) => ({
    ...appt,
    comments: appt.comments || []
  }));

  // CRITICAL FIX: Use filteredArchivedAppointments directly since socket updates them in real-time
  // Remove the updatedComments override that was causing race conditions
  const archivedAppointmentsWithComments = filteredArchivedAppointments.map((appt) => ({
    ...appt,
    comments: appt.comments || []
  }));

  // Add this function to fetch latest data on demand
  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || data);
      }

      const resArchived = await authenticatedFetch(`${API_BASE_URL}/api/bookings/archived`);
      if (resArchived.ok) {
        const archivedData = await resArchived.json();
        setArchivedAppointments(Array.isArray(archivedData) ? archivedData : []);
      }
    } catch (err) {
      // Optionally handle error
    } finally {
      setLoading(false);
    }
  };

  // Function to copy message to clipboard
  const copyMessageToClipboard = (messageText) => {
    if (!messageText) {
      toast.error('No message to copy');
      return;
    }

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(messageText)
        .then(() => {
          toast.success('Copied', {
            autoClose: 2000,
            position: 'bottom-center'
          });
        })
        .catch(() => {
          // Fallback to older method
          copyWithFallback(messageText);
        });
    } else {
      // Use fallback method for older browsers
      copyWithFallback(messageText);
    }
  };

  // Fallback copy method
  const copyWithFallback = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (success) {
        toast.success('Copied', {
          autoClose: 2000,
          position: 'bottom-center'
        });
      } else {
        console.error('Fallback copy failed');
        toast.error('Failed to copy message');
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
      toast.error('Copy not supported');
    }
  };

  // Reactions functionality functions
  const toggleReactionsBar = useCallback((messageId) => {
    if (reactionsMessageId === messageId && showReactionsBar) {
      setShowReactionsBar(false);
      setReactionsMessageId(null);
    } else {
      setShowReactionsBar(true);
      setReactionsMessageId(messageId);
    }
  }, [reactionsMessageId, showReactionsBar]);

  const toggleReactionsEmojiPicker = useCallback(() => {
    setShowReactionsEmojiPicker(prev => !prev);
  }, []);

  // Admin-wide Reports (top-bar)
  const [showAdminReportsModal, setShowAdminReportsModal] = useState(false);
  const [adminReports, setAdminReports] = useState([]);
  const [adminReportsLoading, setAdminReportsLoading] = useState(false);
  const [adminReportsError, setAdminReportsError] = useState('');
  const [adminReportsFilter, setAdminReportsFilter] = useState('message'); // 'message' | 'chat'

  // Admin Reports Filters
  const [adminReportsFilters, setAdminReportsFilters] = useState({
    dateFrom: '',
    dateTo: '',
    reporter: '',
    status: 'all', // 'all', 'pending', 'resolved'
    search: '',
    sortBy: 'date', // 'date', 'user', 'type'
    sortOrder: 'desc' // 'asc', 'desc'
  });

  const fetchAdminReports = useCallback(async (filters = adminReportsFilters, showLoading = true) => {
    try {
      if (showLoading) {
        setAdminReportsLoading(true);
      }
      setAdminReportsError('');

      // Build query parameters
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.reporter) params.append('reporter', filters.reporter);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/reports?${params.toString()}`);
      const data = await res.json();
      if (data?.success) setAdminReports(data.reports || []);
      else setAdminReportsError(data?.message || 'Failed to load reports');
    } catch (_) {
      setAdminReportsError('Network error while loading reports');
    } finally {
      if (showLoading) {
        setAdminReportsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (showAdminReportsModal) fetchAdminReports();
  }, [showAdminReportsModal, fetchAdminReports]);

  // Debounced filter application for admin reports
  useEffect(() => {
    if (!showAdminReportsModal) return;

    const timeoutId = setTimeout(() => {
      fetchAdminReports(adminReportsFilters, false); // Don't show loading for debounced calls
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [adminReportsFilters, showAdminReportsModal, fetchAdminReports]);

  // Prevent background scroll when any Reports modal is open
  useEffect(() => {
    const shouldLock = showAdminReportsModal || false; // appointment-scoped handled in row component
    const previousOverflow = document.body.style.overflow;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow || '';
    }
    return () => {
      document.body.style.overflow = previousOverflow || '';
    };
  }, [showAdminReportsModal]);



  if (loading) return <AdminAppointmentsSkeleton />;

  if (!Array.isArray(appointments)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center transition-colors duration-300">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Session expired or unauthorized</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">Please sign in again to access admin appointments.</p>
          <Link to="/sign-in" className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">Go to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 py-10 px-2 md:px-8 transition-colors duration-300">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>


      <div className="max-w-7xl mx-auto mb-4 flex justify-end">
        <a href="/admin/payments?tab=overview" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v3H2V7z" /><path d="M2 12h20v5a2 2 0 01-2 2H4a2 2 0 01-2-2v-5zm4 3a1 1 0 100 2h6a1 1 0 100-2H6z" /></svg>
          Go to Payments
        </a>
      </div>
      <ToastContainer
        position="top-center"
        autoClose={2000}
        closeOnClick
        containerClassName="!z-[100]"
        toastOptions={{
          style: { fontSize: '0.9rem', borderRadius: '8px', boxShadow: '0 2px 8px #0001' }
        }}
      />
      <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors duration-300">
        {/* Responsive button group: compact on mobile, original on desktop */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow transition-colors">
            {showArchived
              ? `Archived Appointments (${archivedAppointmentsWithComments.length})`
              : `All Appointments (${appointmentsWithComments.length})`}
          </h3>
          <div className="flex flex-row w-full sm:w-auto gap-2 sm:gap-4 justify-center sm:justify-end mt-2 sm:mt-0">
            {/* Reports icon (admin-wide, top bar) */}
            <button
              onClick={() => {
                setShowAdminReportsModal(true);
              }}
              className="bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 px-3 py-2 rounded-md hover:bg-red-50 dark:hover:bg-gray-600 transition-all font-semibold shadow-md flex items-center justify-center gap-2 text-xs sm:text-base sm:px-4 sm:py-2 sm:rounded-lg w-1/2 sm:w-auto"
              title="View all reports"
              aria-label="View all reports"
            >
              <FaFlag className="text-red-600 dark:text-red-400" />
              <span className="hidden sm:inline">Reports</span>
            </button>
            <button
              onClick={handleManualRefresh}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2.5 py-1.5 rounded-md hover:from-blue-600 hover:to-purple-600 transition-all font-semibold shadow-md text-xs sm:text-base sm:px-4 sm:py-2 sm:rounded-lg w-1/2 sm:w-auto"
              title="Refresh appointments"
            >
              Refresh
            </button>
            <button
              onClick={() => {
                setShowArchived(!showArchived);
                setCurrentPage(1); // Reset to first page when switching
                setArchivedCurrentPage(1); // Reset archived page to first page when switching
              }}
              className={`bg-gradient-to-r text-white px-2.5 py-1.5 rounded-md transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1 sm:gap-2 text-xs sm:text-base w-1/2 sm:w-auto sm:px-6 sm:py-3 sm:rounded-lg justify-center ${showArchived
                ? 'from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                : 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
                }`}
            >
              {showArchived ? (
                <>
                  <FaUndo /> <span>Active Appointments</span>
                </>
              ) : (
                <>
                  <FaArchive /> <span>Archived Appointments ({archivedAppointments.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 dark:text-gray-300 mb-6 font-medium">
          {showArchived
            ? "View and manage archived appointments. You can unarchive them to move them back to active appointments."
            : "💡 High data traffic may cause this page to slow down or stop working. Please refresh to continue using it normally.⚠️ Chats are encrypted and secure. View only for valid purposes like disputes or fraud checks. Unauthorized access or sharing is prohibited and will be logged."
          }
        </p>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm dark:text-gray-300">Status:</label>
              <select
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:focus:ring-blue-500 transition-colors"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Appointments</option>
                <option value="pending">Pending Appointments</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="cancelledByBuyer">Cancelled by Buyer</option>
                <option value="cancelledBySeller">Cancelled by Seller</option>
                <option value="cancelledByAdmin">Cancelled by Admin</option>
                <option value="deletedByAdmin">Deleted by Admin</option>
                <option value="completed">Completed</option>
                <option value="noShow">No Show</option>
                <option value="outdated">Outdated</option>
              </select>
            </div>
            {/* Role filter removed for streamlined UI */}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sm dark:text-gray-300">From:</label>
              <input
                type="date"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:[color-scheme:dark] transition-colors"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                max={endDate || undefined}
              />
              <label className="font-semibold text-sm dark:text-gray-300">To:</label>
              <input
                type="date"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:[color-scheme:dark] transition-colors"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
            <div className="flex items-center gap-2">
              <FaSearch className="text-gray-500 hover:text-blue-500 transition-colors duration-200 dark:text-gray-400" />
              <input
                type="text"
                className="border rounded px-2 py-1 focus:outline-none focus:ring focus:ring-blue-200 text-sm flex-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 transition-colors"
                placeholder="Search by email, property, or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {showArchived ? (
          // Archived Appointments Section
          archivedAppointmentsWithComments.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 text-lg transition-colors">No archived appointments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 transition-colors">
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Date & Time</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Property</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Payment</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Buyer</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Seller</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Purpose</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Message</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Status</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Actions</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Connect</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedAppointmentsWithComments.map((appt, index) => (
                    <AdminAppointmentRow
                      style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                      key={appt._id}
                      appt={appt}
                      currentUser={currentUser}
                      handleAdminCancel={handleAdminCancel}
                      handleReinitiateAppointment={handleReinitiateAppointment}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      onUserClick={handleUserClick}
                      isArchived={true}
                      copyMessageToClipboard={copyMessageToClipboard}
                      updateAppointmentComments={updateAppointmentComments}
                      // Modal states
                      showCancelModal={showCancelModal}
                      setShowCancelModal={setShowCancelModal}
                      showReinitiateModal={showReinitiateModal}
                      setShowReinitiateModal={setShowReinitiateModal}
                      reinitiatePaymentStatus={reinitiatePaymentStatus}
                      setReinitiatePaymentStatus={setReinitiatePaymentStatus}
                      showArchiveModal={showArchiveModal}
                      setShowArchiveModal={setShowArchiveModal}
                      showUnarchiveModal={showUnarchiveModal}
                      setShowUnarchiveModal={setShowUnarchiveModal}
                      appointmentToHandle={appointmentToHandle}
                      setAppointmentToHandle={setAppointmentToHandle}
                      cancelReason={cancelReason}
                      setCancelReason={setCancelReason}
                      confirmAdminCancel={confirmAdminCancel}
                      confirmReinitiate={confirmReinitiate}
                      confirmArchive={confirmArchive}
                      confirmUnarchive={confirmUnarchive}
                      // Reactions props
                      showReactionsBar={showReactionsBar}
                      setShowReactionsBar={setShowReactionsBar}
                      reactionsMessageId={reactionsMessageId}
                      setReactionsMessageId={setReactionsMessageId}
                      showReactionsEmojiPicker={showReactionsEmojiPicker}
                      setShowReactionsEmojiPicker={setShowReactionsEmojiPicker}
                      reactionEmojiSearchTerm={reactionEmojiSearchTerm}
                      setReactionEmojiSearchTerm={setReactionEmojiSearchTerm}
                      getFilteredEmojis={getFilteredEmojis}
                      toggleReactionsBar={toggleReactionsBar}
                      toggleReactionsEmojiPicker={toggleReactionsEmojiPicker}
                      onExportChat={(appointment, comments, callHistory) => {
                        setExportAppointment(appointment);
                        setExportComments(comments);
                        setExportCallHistory(callHistory || []);
                        setShowExportModal(true);
                      }}
                      activeChatAppointmentId={activeChatAppointmentId}
                      shouldOpenChatFromNotification={shouldOpenChatFromNotification}
                      onChatOpened={() => {
                        setShouldOpenChatFromNotification(false);
                        setActiveChatAppointmentId(null);
                      }}
                      // Call History Modal props
                      setShowCallHistoryModal={setShowCallHistoryModal}
                      setCallHistoryAppointmentId={setCallHistoryAppointmentId}
                      isMobile={isMobile}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // Active Appointments Section
          appointmentsWithComments.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 text-lg transition-colors">No appointments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-950 dark:to-purple-950 transition-colors">
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Date & Time</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Property</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Payment</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Buyer</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Seller</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Purpose</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Message</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Status</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Actions</th>
                    <th className="border dark:border-gray-600 p-2 text-gray-700 dark:text-gray-200 transition-colors">Connect</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsWithComments.map((appt, index) => (
                    <AdminAppointmentRow
                      style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s backwards` }}
                      key={appt._id}
                      appt={appt}
                      currentUser={currentUser}
                      handleAdminCancel={handleAdminCancel}
                      handleReinitiateAppointment={handleReinitiateAppointment}
                      handleArchiveAppointment={handleArchiveAppointment}
                      handleUnarchiveAppointment={handleUnarchiveAppointment}
                      onUserClick={handleUserClick}
                      isArchived={false}
                      copyMessageToClipboard={copyMessageToClipboard}
                      updateAppointmentComments={updateAppointmentComments}
                      // Modal states
                      showCancelModal={showCancelModal}
                      setShowCancelModal={setShowCancelModal}
                      showReinitiateModal={showReinitiateModal}
                      setShowReinitiateModal={setShowReinitiateModal}
                      reinitiatePaymentStatus={reinitiatePaymentStatus}
                      setReinitiatePaymentStatus={setReinitiatePaymentStatus}
                      showArchiveModal={showArchiveModal}
                      setShowArchiveModal={setShowArchiveModal}
                      showUnarchiveModal={showUnarchiveModal}
                      setShowUnarchiveModal={setShowUnarchiveModal}
                      appointmentToHandle={appointmentToHandle}
                      setAppointmentToHandle={setAppointmentToHandle}
                      cancelReason={cancelReason}
                      setCancelReason={setCancelReason}
                      confirmAdminCancel={confirmAdminCancel}
                      confirmReinitiate={confirmReinitiate}
                      confirmArchive={confirmArchive}
                      confirmUnarchive={confirmUnarchive}
                      // Reactions props
                      showReactionsBar={showReactionsBar}
                      setShowReactionsBar={setShowReactionsBar}
                      reactionsMessageId={reactionsMessageId}
                      setReactionsMessageId={setReactionsMessageId}
                      showReactionsEmojiPicker={showReactionsEmojiPicker}
                      setShowReactionsEmojiPicker={setShowReactionsEmojiPicker}
                      reactionEmojiSearchTerm={reactionEmojiSearchTerm}
                      setReactionEmojiSearchTerm={setReactionEmojiSearchTerm}
                      getFilteredEmojis={getFilteredEmojis}
                      toggleReactionsBar={toggleReactionsBar}
                      toggleReactionsEmojiPicker={toggleReactionsEmojiPicker}
                      onExportChat={(appointment, comments, callHistory) => {
                        setExportAppointment(appointment);
                        setExportComments(comments);
                        setExportCallHistory(callHistory || []);
                        setShowExportModal(true);
                      }}
                      activeChatAppointmentId={activeChatAppointmentId}
                      shouldOpenChatFromNotification={shouldOpenChatFromNotification}
                      onChatOpened={() => {
                        setShouldOpenChatFromNotification(false);
                        setActiveChatAppointmentId(null);
                      }}
                      // Call History Modal props
                      setShowCallHistoryModal={setShowCallHistoryModal}
                      setCallHistoryAppointmentId={setCallHistoryAppointmentId}
                      isMobile={isMobile}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination for regular appointments */}
        {!showArchived && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setCurrentPage(Math.max(1, currentPage - 1));
                  toast.info(`Navigated to page ${Math.max(1, currentPage - 1)}`);
                }}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setCurrentPage(Math.min(totalPages, currentPage + 1));
                  toast.info(`Navigated to page ${Math.min(totalPages, currentPage + 1)}`);
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Reports Modal - Admin-wide (styled like Starred Messages) */}
        {showAdminReportsModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 flex-shrink-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaFlag className="text-red-500" /> Reported Items
                </h3>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="flex items-center bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 rounded-lg overflow-hidden mr-1 sm:mr-2">
                    <button
                      className={`px-2 sm:px-3 py-1.5 text-xs font-medium ${adminReportsFilter === 'message' ? 'bg-red-500 text-white' : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50'}`}
                      onClick={() => setAdminReportsFilter('message')}
                    >
                      Message Reports
                    </button>
                    <button
                      className={`px-2 sm:px-3 py-1.5 text-xs font-medium border-l border-red-200 dark:border-red-800 ${adminReportsFilter === 'chat' ? 'bg-red-500 text-white' : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50'}`}
                      onClick={() => setAdminReportsFilter('chat')}
                    >
                      Chat Reports
                    </button>
                  </div>
                  <button
                    onClick={() => fetchAdminReports(adminReportsFilters, true)}
                    disabled={adminReportsLoading}
                    className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh reports"
                  >
                    {adminReportsLoading ? (
                      <UrbanSetuSpinner size="sm" />
                    ) : (
                      <FaSync className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowAdminReportsModal(false)}
                    className="px-2 sm:px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-xs sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Filters Section - Mobile Optimized */}
              <div className="p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 sticky top-0 z-10">
                <div className="space-y-3">
                  {/* Primary filters - compact on mobile */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                      <input
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        value={adminReportsFilters.dateFrom}
                        onChange={(e) => setAdminReportsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
                      <input
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        value={adminReportsFilters.dateTo}
                        onChange={(e) => setAdminReportsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reporter</label>
                      <input
                        type="text"
                        placeholder="Reporter"
                        value={adminReportsFilters.reporter}
                        onChange={(e) => setAdminReportsFilters(prev => ({ ...prev, reporter: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <select
                        value={adminReportsFilters.status}
                        onChange={(e) => setAdminReportsFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  {/* Secondary controls - compact on mobile */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center justify-between">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={adminReportsFilters.search}
                        onChange={(e) => setAdminReportsFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="flex-1 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <select
                        value={adminReportsFilters.sortBy}
                        onChange={(e) => setAdminReportsFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="date">Date</option>
                        <option value="user">User</option>
                        <option value="type">Type</option>
                      </select>
                      <select
                        value={adminReportsFilters.sortOrder}
                        onChange={(e) => setAdminReportsFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="desc">↓</option>
                        <option value="asc">↑</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAdminReportsFilters({
                          dateFrom: '',
                          dateTo: '',
                          reporter: '',
                          status: 'all',
                          search: '',
                          sortBy: 'date',
                          sortOrder: 'desc'
                        })}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => fetchAdminReports(adminReportsFilters, true)}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Report count - compact on mobile */}
                  <div className="text-xs text-gray-600 text-center sm:text-left">
                    Showing {adminReports.length} reports
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                {adminReportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <UrbanSetuSpinner size="md" />
                    <span className="ml-3 text-gray-600 dark:text-gray-300">Loading reports...</span>
                  </div>
                ) : adminReportsError ? (
                  <div className="text-sm text-red-600">{adminReportsError}</div>
                ) : (adminReports || []).length === 0 ? (
                  <div className="text-center py-12">
                    <FaFlag className="mx-auto text-6xl text-gray-300 dark:text-gray-600 mb-4" />
                    <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Reports</h4>
                    <p className="text-gray-500 dark:text-gray-500">There are no reports matching your filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(adminReports || []).filter(r => adminReportsFilter === 'message' ? r.type === 'message' : r.type !== 'message').map((r, idx) => (
                      <div key={r.notificationId || idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <FaFlag className="text-red-500" /> {r.type === 'message' ? 'Message Report' : 'Chat Report'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(r.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                          {r.reporter && (<div><span className="font-medium">Reporter:</span> {r.reporter}</div>)}
                          {r.appointmentRef && (<div><span className="font-medium">Appointment:</span> {r.appointmentRef}</div>)}
                          {r.between && (<div><span className="font-medium">Between:</span> {r.between}</div>)}
                          {r.reason && (<div><span className="font-medium">Reason:</span> {r.reason}</div>)}
                          {r.details && (<div className="md:col-span-2"><span className="font-medium">Details:</span> {r.details}</div>)}
                          {r.messageId && (<div><span className="font-medium">Message ID:</span> {r.messageId}</div>)}
                          {r.messageExcerpt && (
                            <div className="md:col-span-2 italic text-gray-600 dark:text-gray-400">
                              <span className="font-medium not-italic">Excerpt:</span> "{r.messageExcerpt}"
                            </div>
                          )}
                          {r.totalMessages != null && (<div><span className="font-medium">Total Messages:</span> {r.totalMessages}</div>)}
                          {r.appointmentDate && (<div><span className="font-medium">Appointment Date:</span> {r.appointmentDate}</div>)}
                          {r.property && (<div><span className="font-medium">Property:</span> {r.property}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ), document.body)}



        {/* Pagination for archived appointments */}
        {showArchived && archivedTotalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-2">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Archived Page {archivedCurrentPage} of {archivedTotalPages}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setArchivedCurrentPage(Math.max(1, archivedCurrentPage - 1));
                  toast.info(`Navigated to archived page ${Math.max(1, archivedCurrentPage - 1)}`);
                }}
                disabled={archivedCurrentPage === 1}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setArchivedCurrentPage(Math.min(archivedTotalPages, archivedCurrentPage + 1));
                  toast.info(`Navigated to archived page ${Math.min(archivedTotalPages, archivedCurrentPage + 1)}`);
                }}
                disabled={archivedCurrentPage === archivedTotalPages}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Modal - Enhanced Design */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" style={{ overflow: 'hidden' }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto relative animate-fadeIn">
            {/* Close button */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors z-40 shadow"
              onClick={() => setShowUserModal(false)}
              title="Close"
              aria-label="Close"
            >
              <FaTimes className="w-4 h-4" />
            </button>

            {userLoading ? (
              <div className="flex items-center justify-center p-8">
                <UrbanSetuSpinner size="md" />
                <p className="ml-4 text-gray-600 dark:text-gray-300">Loading user details...</p>
              </div>
            ) : selectedUser ? (
              <>
                {/* Header with gradient background (sticky on mobile) */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-t-2xl px-6 py-6 border-b border-gray-200 dark:border-gray-700 sticky top-[env(safe-area-inset-top,0px)] z-20">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <UserAvatar
                        user={{ username: selectedUser.username, avatar: selectedUser.avatar }}
                        size="w-16 h-16"
                        textSize="text-lg"
                        showBorder={true}
                        className="border-4 border-white dark:border-gray-700 shadow-lg"
                      />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                        {selectedUser.role === 'admin' || selectedUser.role === 'rootadmin' ? (
                          <FaUserShield className="w-3 h-3 text-white" />
                        ) : (
                          <FaUser className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        {selectedUser.username}
                        {(selectedUser.role === 'admin' || selectedUser.role === 'rootadmin') && (
                          <FaUserShield className="text-purple-600 text-base" title="Admin user" />
                        )}
                      </h2>
                      <div className="flex gap-2 mt-1">
                        <p className="text-sm text-gray-600 dark:text-gray-300 capitalize font-medium bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
                          {selectedUser.role || 'User'}
                        </p>
                        {selectedUser.adminApprovalStatus && (
                          <p className={`text-xs font-medium px-2 py-1 rounded-full ${selectedUser.adminApprovalStatus === 'approved'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                            : selectedUser.adminApprovalStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                            }`}>
                            {selectedUser.adminApprovalStatus}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body with enhanced styling */}
                <div className="px-6 py-6 space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-blue-500">
                      <FaEnvelope className="text-blue-500 w-5 h-5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wide font-semibold">Email</p>
                        <a
                          href={`mailto:${selectedUser.email}`}
                          className="text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors duration-200"
                          title="Click to send email"
                        >
                          {selectedUser.email}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-green-500">
                      <FaPhone className="text-green-500 w-5 h-5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wide font-semibold">Phone</p>
                        {selectedUser.mobileNumber && selectedUser.mobileNumber !== '' ? (
                          <button
                            onClick={() => handlePhoneClick(selectedUser.mobileNumber)}
                            className="text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline font-medium transition-colors duration-200 text-left"
                            title="Click to call or copy phone number"
                          >
                            {selectedUser.mobileNumber}
                          </button>
                        ) : (
                          <p className="text-gray-800 dark:text-gray-300 font-medium">Not provided</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-purple-500">
                      <FaCalendar className="text-purple-500 w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wide font-semibold">Member Since</p>
                        <p className="text-gray-800 dark:text-white font-medium">
                          {new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>


                </div>
              </>
            ) : (
              <div className="flex items-center justify-center p-8">
                <p className="text-gray-600">User not found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Chat Modal */}
      <ExportChatModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setExportAppointment(null);
          setExportComments([]);
          setExportCallHistory([]);
        }}
        onExport={async (includeMedia) => {
          try {
            toast.info('Generating PDF...', { autoClose: 2000 });
            const otherParty = exportAppointment?.buyerId?._id === currentUser._id ? exportAppointment?.sellerId : exportAppointment?.buyerId;
            const result = await exportEnhancedChatToPDF(
              exportAppointment,
              exportComments,
              currentUser,
              otherParty,
              includeMedia
            );
            if (result.success) {
              toast.success(`Chat transcript exported as ${result.filename}`);
            } else {
              toast.error(`Export failed: ${result.error}`);
            }
          } catch (error) {
            toast.error('Failed to export chat transcript');
            console.error('Export error:', error);
          }
        }}
        appointment={exportAppointment}
        messageCount={exportComments.filter(msg => !msg.deleted && (msg.message?.trim() || msg.imageUrl || msg.audioUrl || msg.videoUrl || msg.documentUrl)).length}
        imageCount={exportComments.filter(msg => msg.imageUrl && !msg.deleted).length}
      />

      {/* Call History Modal - Global for all chat modals */}
      <CallHistoryModal
        appointmentId={callHistoryAppointmentId}
        isOpen={showCallHistoryModal}
        onClose={() => {
          setShowCallHistoryModal(false);
          setCallHistoryAppointmentId(null);
        }}
        currentUser={currentUser}
        isAdmin={true}
      />

      {/* Missing Appointment Error Modal */}
      {missingChatbookError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden transform transition-all scale-100">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-pink-600"></div>
            <div className="text-center">
              <div className="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaBan className="text-red-500 text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Appointment Not Found</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The appointment you are trying to access could not be found. It may have been deleted, archived, or does not exist.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setMissingChatbookError(null);
                    navigate('/admin/appointments', { replace: true });
                  }}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDateLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function AdminPaymentStatusCell({ appointmentId, appointment }) {
  const [payment, setPayment] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [toggling, setToggling] = React.useState(false);
  const [showStatusOptions, setShowStatusOptions] = React.useState(false);

  React.useEffect(() => {
    async function fetchPayment() {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?appointmentId=${appointmentId}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.payments) && data.payments.length > 0) {
          setPayment(data.payments[0]);
        } else {
          setPayment(null);
        }
      } catch {
        setPayment(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPayment();
  }, [appointmentId]);

  // Close status options when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStatusOptions && !event.target.closest('.status-options-container')) {
        setShowStatusOptions(false);
      }
    };

    if (showStatusOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatusOptions]);

  const handleStatusChange = async (newStatus) => {
    if (!appointment) return;
    if (appointment?.paymentConfirmed === newStatus) return;
    setToggling(true);
    setShowStatusOptions(false);
    try {
      if (newStatus) {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/payments/admin/mark-paid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId })
        });
        if (res.ok) {
          const hist = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?appointmentId=${appointmentId}`);
          const data = await hist.json();
          if (hist.ok && Array.isArray(data.payments)) setPayment(data.payments[0] || null);
        }
      } else {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/payments/admin/mark-unpaid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId })
        });
        if (res.ok) {
          const hist = await authenticatedFetch(`${API_BASE_URL}/api/payments/history?appointmentId=${appointmentId}`);
          const data = await hist.json();
          if (hist.ok && Array.isArray(data.payments)) setPayment(data.payments[0] || null);
        }
      }
    } finally {
      setToggling(false);
    }
  };

  const statusButton = (
    <div className="mt-1 relative status-options-container">
      <button
        onClick={() => setShowStatusOptions(!showStatusOptions)}
        disabled={toggling}
        className="text-[10px] px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
        title="Change payment status"
      >
        {toggling ? 'Updating...' : 'Change Status'}
      </button>

      {showStatusOptions && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-50 min-w-[120px]">
          {!appointment?.paymentConfirmed ? (
            <button
              onClick={() => handleStatusChange(true)}
              className="w-full text-left px-3 py-2 text-[10px] text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 border-b border-gray-100 dark:border-gray-700"
            >
              Mark Paid
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange(false)}
              className="w-full text-left px-3 py-2 text-[10px] text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border-b border-gray-100 dark:border-gray-700"
            >
              Mark Unpaid
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div>;
  }

  if (!payment) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${appointment?.paymentConfirmed
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
          {appointment?.paymentConfirmed ? 'Paid (Admin)' : 'Pending'}
        </span>
        {appointment?.paymentConfirmed && (
          <div className="text-[10px] text-green-700 dark:text-green-400 font-semibold">✓ Admin Confirmed</div>
        )}
        {statusButton}
      </div>
    );
  }

  // Priority: User payment first, then admin marking
  const isAdminMarked = Boolean(payment?.metadata?.adminMarked);
  const color = payment.status === 'completed'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : isAdminMarked
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : payment.status === 'pending'
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
        : payment.status === 'failed'
          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          : payment.status === 'refunded'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            : payment.status === 'partially_refunded'
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

  // Priority: User payment first, then admin marking
  const label = payment.status === 'completed'
    ? 'Paid'
    : isAdminMarked
      ? 'Paid (Admin)'
      : payment.status === 'pending'
        ? 'Pending'
        : payment.status === 'failed'
          ? 'Failed'
          : payment.status === 'refunded'
            ? 'Refunded'
            : payment.status === 'partially_refunded'
              ? 'Partial Refund'
              : payment.status;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>
      {typeof payment.amount === 'number' && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
          {((payment.currency || 'USD') === 'INR') ? (
            <span>₹ {Number(payment.amount).toFixed(2)}</span>
          ) : (
            <span>$ {Number(payment.amount).toFixed(2)}</span>
          )}
        </div>
      )}
      {payment.refundAmount > 0 && (
        <div className="text-[10px] text-red-500 dark:text-red-400">
          <div>Refunded: {((payment.currency || 'USD') === 'INR') ? '₹' : '$'}{Number(payment.refundAmount).toFixed(2)}</div>
          {payment.refundedAt && (
            <div className="text-red-400">
              {new Date(payment.refundedAt).toLocaleDateString('en-GB')} {new Date(payment.refundedAt).toLocaleTimeString('en-GB')}
            </div>
          )}
        </div>
      )}
      {appointment?.paymentConfirmed && (
        <div className="text-[10px] text-green-700 dark:text-green-400 font-semibold">✓ Admin Confirmed</div>
      )}
      {statusButton}
    </div>
  );
}

function AdminAppointmentRow({
  appt,
  currentUser,
  handleAdminCancel,
  handleReinitiateAppointment,
  handleArchiveAppointment,
  handleUnarchiveAppointment,
  onUserClick,
  isArchived,
  copyMessageToClipboard,
  updateAppointmentComments,
  // Modal states from parent
  showCancelModal,
  setShowCancelModal,
  showReinitiateModal,
  setShowReinitiateModal,
  reinitiatePaymentStatus,
  setReinitiatePaymentStatus,
  showArchiveModal,
  setShowArchiveModal,
  showUnarchiveModal,
  setShowUnarchiveModal,
  appointmentToHandle,
  setAppointmentToHandle,
  cancelReason,
  setCancelReason,
  confirmAdminCancel,
  confirmReinitiate,
  confirmArchive,
  confirmUnarchive,
  // Reactions props from parent
  showReactionsBar,
  setShowReactionsBar,
  reactionsMessageId,
  setReactionsMessageId,
  showReactionsEmojiPicker,
  setShowReactionsEmojiPicker,
  reactionEmojiSearchTerm,
  setReactionEmojiSearchTerm,
  getFilteredEmojis,
  toggleReactionsBar,
  toggleReactionsEmojiPicker,
  onExportChat,
  // URL-based chat opening props
  activeChatAppointmentId,
  shouldOpenChatFromNotification,
  onChatOpened,
  // Call History Modal props
  setShowCallHistoryModal,
  setCallHistoryAppointmentId,
  isMobile
}) {
  const navigate = useNavigate();
  const params = useParams();
  const { playMessageSent, playTyping } = useSoundEffects();
  const { signout } = useSignout();


  // Use parent comments directly for real-time sync, with local state for UI interactions
  const [localComments, setLocalComments] = React.useState(appt.comments || []);
  const [callHistory, setCallHistory] = React.useState([]);

  // Initialize starred messages when comments are loaded
  React.useEffect(() => {
    if (localComments.length > 0) {
      const starredMsgs = localComments.filter(c => c.starredBy && c.starredBy.includes(currentUser._id));
      setStarredMessages(starredMsgs);
    }
  }, [localComments, currentUser._id]);

  // Sync local comments with parent state (for real-time updates)
  React.useEffect(() => {
    if (appt?.comments) {
      setLocalComments(prev => {
        // Keep any local temporary/sending messages
        const tempMessages = prev.filter(c => c._id && typeof c._id === 'string' && c._id.startsWith('temp-'));

        // Return parent comments + temp messages
        // Check for duplicates just in case a temp message got confirmed but not cleared
        const parentIds = new Set(appt.comments.map(c => c._id));
        const uniqueTemps = tempMessages.filter(t => !parentIds.has(t._id));

        return [...appt.comments, ...uniqueTemps];
      });
    }
  }, [appt.comments]);
  const [newComment, setNewComment] = useLocalState("");
  const [detectedUrl, setDetectedUrl] = useState(null);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [lastDismissedUrl, setLastDismissedUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sending, setSending] = useLocalState(false);
  const [editingComment, setEditingComment] = useLocalState(null);
  const [editText, setEditText] = useLocalState("");
  const [originalDraft, setOriginalDraft] = useLocalState("");
  const [savingComment, setSavingComment] = useLocalState(null);
  const [replyTo, setReplyTo] = useLocalState(null);
  const [showChatModal, setShowChatModal] = useLocalState(false);

  React.useEffect(() => {
    if (showChatModal) {
      const buyerName = appt.buyerId?.username || 'Buyer';
      const sellerName = appt.sellerId?.username || 'Seller';
      document.title = `Audit Chat: ${buyerName} & ${sellerName} · UrbanSetu`;
    } else {
      if (document.title.includes("Audit Chat:")) {
        document.title = "Appointment Management - Admin Panel · UrbanSetu";
      }
    }
    return () => {
      if (showChatModal) {
        document.title = "Appointment Management - Admin Panel · UrbanSetu";
      }
    };
  }, [showChatModal, appt.buyerId, appt.sellerId]);

  const [showPasswordModal, setShowPasswordModal] = useLocalState(false);
  const [adminPassword, setAdminPassword] = useLocalState("");
  const [passwordError, setPasswordError] = useLocalState("");
  const [showDeleteModal, setShowDeleteModal] = useLocalState(false);
  const [messageToDelete, setMessageToDelete] = useLocalState(null);
  const [deleteMessageLoading, setDeleteMessageLoading] = useLocalState(false);
  const [passwordLoading, setPasswordLoading] = useLocalState(false);
  const [loadingComments, setLoadingComments] = useLocalState(false);
  const chatEndRef = React.useRef(null);
  const chatContainerRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // Keyboard shortcut to focus input
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && e.ctrlKey && showChatModal && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChatModal]);
  const passwordInputRef = React.useRef(null);
  const prevServerCommentsLengthRef = React.useRef(0);
  const [allProperties, setAllProperties] = useState([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [allBlogs, setAllBlogs] = useState([]);
  const [blogsLoaded, setBlogsLoaded] = useState(false);
  const [isLoadingBlogSuggestions, setIsLoadingBlogSuggestions] = useState(false);
  const messageRefs = React.useRef({});
  const [isAtBottom, setIsAtBottom] = useLocalState(true);
  const [unreadNewMessages, setUnreadNewMessages] = useLocalState(0);
  // Infinite scroll/pagination for chat
  const MESSAGES_PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useLocalState(MESSAGES_PAGE_SIZE);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useLocalState(false);
  const loadingOlderRef = React.useRef(false);
  const [currentFloatingDate, setCurrentFloatingDate] = useLocalState('');
  const [isScrolling, setIsScrolling] = useLocalState(false);
  const [showShortcutTip, setShowShortcutTip] = useLocalState(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useLocalState(() => getLocallyHiddenIds(appt._id));
  const [headerOptionsMessageId, setHeaderOptionsMessageId] = useLocalState(null);
  const [showHeaderMoreMenu, setShowHeaderMoreMenu] = useLocalState(false);
  const scrollTimeoutRef = React.useRef(null);
  const [showDeleteChatModal, setShowDeleteChatModal] = useLocalState(false);
  // Reports modal state (admin-wide)
  const [showReportsModal, setShowReportsModal] = useLocalState(false);
  const [reports, setReports] = useLocalState([]);
  const [reportsLoading, setReportsLoading] = useLocalState(false);
  const [reportsError, setReportsError] = useLocalState('');
  const [reportsFilter, setReportsFilter] = useLocalState('message'); // 'message' | 'chat'

  // Appointment Reports Filters
  const [reportsFilters, setReportsFilters] = useLocalState({
    dateFrom: '',
    dateTo: '',
    reporter: '',
    messageType: 'all', // 'all', 'text', 'image', 'video', 'audio', 'document'
    search: '',
    sortBy: 'date', // 'date', 'user', 'type'
    sortOrder: 'desc' // 'asc', 'desc'
  });

  // Reported message IDs for current appointment (to flag in UI)
  const [reportedMessageIds, setReportedMessageIds] = useLocalState([]);

  // Report details tooltip state
  const [reportTooltip, setReportTooltip] = useLocalState({
    show: false,
    messageId: null,
    details: null,
    position: { x: 0, y: 0 }
  });

  const fetchAllReports = useCallback(async (appointmentId, filters = reportsFilters, showLoading = true) => {
    try {
      if (showLoading) {
        setReportsLoading(true);
      }
      setReportsError('');

      // Build query parameters
      const params = new URLSearchParams();
      if (appointmentId) params.append('appointmentId', appointmentId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.reporter) params.append('reporter', filters.reporter);
      if (filters.messageType !== 'all') params.append('messageType', filters.messageType);
      if (filters.search) params.append('search', filters.search);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/reports?${params.toString()}`);
      const data = await res.json();
      if (data?.success) setReports(data.reports || []);
      else setReportsError(data?.message || 'Failed to load reports');
    } catch (e) {
      setReportsError('Network error while loading reports');
    } finally {
      if (showLoading) {
        setReportsLoading(false);
      }
    }
  }, []);

  // Load appointment-scoped reports when its modal opens
  useEffect(() => {
    if (showReportsModal) {
      fetchAllReports(appt._id);
    }
  }, [showReportsModal, fetchAllReports, appt._id]);

  // Debounced filter application for appointment reports
  useEffect(() => {
    if (!showReportsModal) return;

    const timeoutId = setTimeout(() => {
      fetchAllReports(appt._id, reportsFilters, false); // Don't show loading for debounced calls
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [reportsFilters, showReportsModal, fetchAllReports, appt._id]);

  // Prevent background scroll when appointment-scoped reports modal is open
  useEffect(() => {
    if (!showReportsModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow || ''; };
  }, [showReportsModal]);

  const fetchReportedMessageIds = useCallback(async (appointmentId) => {
    if (!appointmentId) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/reports/message-ids?appointmentId=${appointmentId}`);
      const data = await res.json();
      if (data?.success) setReportedMessageIds(data.messageIds || []);
    } catch (_) { }
  }, []);

  // Fetch report details for a specific message
  const fetchReportDetails = useCallback(async (messageId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/reports?messageId=${messageId}`);
      const data = await res.json();
      if (data?.success && data.reports && data.reports.length > 0) {
        return data.reports[0]; // Return the first (most recent) report
      }
    } catch (_) {
      // Handle error silently
    }
    return null;
  }, []);

  // Handle flag hover to show report details
  const handleFlagHover = useCallback(async (messageId, event) => {
    if (reportTooltip.show && reportTooltip.messageId === messageId) return;

    const rect = event.target.getBoundingClientRect();
    const details = await fetchReportDetails(messageId);

    if (details) {
      setReportTooltip({
        show: true,
        messageId,
        details,
        position: {
          x: rect.right + 10,
          y: rect.top - 10
        }
      });
    }
  }, [reportTooltip.show, reportTooltip.messageId, fetchReportDetails]);

  // Handle flag mouse leave to hide tooltip
  const handleFlagLeave = useCallback(() => {
    setReportTooltip({
      show: false,
      messageId: null,
      details: null,
      position: { x: 0, y: 0 }
    });
  }, []);
  const [deleteChatPassword, setDeleteChatPassword] = useLocalState("");
  const [deleteChatLoading, setDeleteChatLoading] = useLocalState(false);

  // Message info modal state
  const [showMessageInfoModal, setShowMessageInfoModal] = useLocalState(false);
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useLocalState(null);
  // Call info modal state
  const [showCallInfoModal, setShowCallInfoModal] = useLocalState(false);
  const [selectedCallForInfo, setSelectedCallForInfo] = useLocalState(null);
  // Live call monitor modal state (admin view)
  const [showLiveMonitorModal, setShowLiveMonitorModal] = useLocalState(false);

  // Live monitor WebRTC state for admin (receive-only)
  const [monitorCallId, setMonitorCallId] = useLocalState(null);
  const [buyerMonitorStream, setBuyerMonitorStream] = useLocalState(null);
  const [sellerMonitorStream, setSellerMonitorStream] = useLocalState(null);
  const buyerMonitorVideoRef = React.useRef(null);
  const sellerMonitorVideoRef = React.useRef(null);
  const monitorPeersRef = React.useRef({ caller: null, receiver: null });
  const [focusedMonitorView, setFocusedMonitorView] = useLocalState(null);
  const [monitorAudioMuted, setMonitorAudioMuted] = useLocalState({ buyer: true, seller: true });
  const [monitorVideoHidden, setMonitorVideoHidden] = useLocalState({ buyer: false, seller: false });
  const [showForceTerminateModal, setShowForceTerminateModal] = useLocalState(false);
  const [forceTerminateReason, setForceTerminateReason] = useLocalState('');
  const [forceTerminateLoading, setForceTerminateLoading] = useLocalState(false);
  const [screenSharingStatus, setScreenSharingStatus] = useLocalState({ buyer: false, seller: false });
  const [monitorRefreshing, setMonitorRefreshing] = useLocalState(false);
  const [participantMediaStatus, setParticipantMediaStatus] = useLocalState({
    buyer: { isMuted: false, isVideoEnabled: true },
    seller: { isMuted: false, isVideoEnabled: true }
  });

  // Auto-reset layout back to Split View if screen share ends
  React.useEffect(() => {
    if (focusedMonitorView === 'presentation' && !screenSharingStatus.buyer && !screenSharingStatus.seller) {
      setFocusedMonitorView(null);
    }
  }, [screenSharingStatus.buyer, screenSharingStatus.seller, focusedMonitorView, setFocusedMonitorView]);

  // Audio activity detection for monitor
  const isBuyerSpeaking = useAudioActivity(buyerMonitorStream);
  const isSellerSpeaking = useAudioActivity(sellerMonitorStream);

  // STUN servers for admin WebRTC monitor (same as participant side)
  const MONITOR_STUN_SERVERS = React.useMemo(() => ([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]), []);

  const toggleMonitorAudio = useCallback((roleKey) => {
    setMonitorAudioMuted((prev) => ({ ...prev, [roleKey]: !prev[roleKey] }));
  }, [setMonitorAudioMuted]);

  const toggleMonitorVideo = useCallback((roleKey) => {
    setMonitorVideoHidden((prev) => ({ ...prev, [roleKey]: !prev[roleKey] }));
  }, [setMonitorVideoHidden]);

  const toggleFocusView = useCallback((roleKey) => {
    setFocusedMonitorView((prev) => (prev === roleKey ? null : roleKey));
  }, [setFocusedMonitorView]);

  // Detect potentially active calls for this appointment based on call history status
  const activeLiveCall = React.useMemo(() => {
    if (!Array.isArray(callHistory) || callHistory.length === 0) return null;
    // Treat calls that are ringing / initiated / accepted as potentially live
    return callHistory.find(call =>
      ["initiated", "ringing", "accepted"].includes(call.status)
    ) || null;
  }, [callHistory]);

  // Helper to fetch latest call history for this appointment and return active call
  const fetchLatestActiveCall = React.useCallback(async () => {
    if (!appt?._id) return null;
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/history/${appt._id}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data.calls)) {
        setCallHistory(data.calls);
        return data.calls.find(call =>
          ["initiated", "ringing", "accepted"].includes(call.status)
        ) || null;
      }
    } catch (err) {
      console.error('Error fetching latest call history for live monitor:', err);
    }
    return null;
  }, [appt?._id]);

  const handleForceTerminateCall = useCallback(async () => {
    if (!socket || !activeLiveCall) {
      toast.error('No active call to terminate');
      return;
    }

    setForceTerminateLoading(true);

    try {
      // Emit socket event to terminate call
      socket.emit('admin-force-end-call', {
        callId: activeLiveCall.callId,
        reason: forceTerminateReason.trim(),
        appointmentId: appt._id
      });

      // Send email notifications to both buyer and seller
      try {
        const emailResponse = await authenticatedFetch(`${API_BASE_URL}/api/calls/admin/terminate-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            appointmentId: appt._id,
            callId: activeLiveCall.callId,
            buyerId: appt.buyerId?._id || appt.buyerId,
            sellerId: appt.sellerId?._id || appt.sellerId,
            buyerEmail: appt.buyerId?.email,
            sellerEmail: appt.sellerId?.email,
            buyerName: appt.buyerId?.username || 'Buyer',
            sellerName: appt.sellerId?.username || 'Seller',
            propertyName: appt.propertyName || 'Property',
            reason: forceTerminateReason.trim() || 'Administrative action',
            appointmentDate: appt.date,
            appointmentTime: appt.time
            // Call details (callType, startTime, duration) are now fetched from DB by backend
          })
        });

        if (emailResponse.ok) {
          console.log('Termination emails sent successfully');
        } else {
          console.warn('Failed to send termination emails');
        }
      } catch (emailError) {
        console.error('Error sending termination emails:', emailError);
        // Don't fail the termination if email fails
      }

      // Safety timeout - close modal and reset state after 5 seconds
      setTimeout(() => {
        setForceTerminateLoading(false);
      }, 5000);

    } catch (error) {
      console.error('Error terminating call:', error);
      toast.error('Failed to terminate call');
      setForceTerminateLoading(false);
    }
  }, [socket, activeLiveCall, forceTerminateReason, setForceTerminateLoading, appt]);

  // Map call roles (caller/receiver) to buyer/seller for labeling streams
  const monitorRoles = React.useMemo(() => {
    if (!activeLiveCall || !appt?.buyerId?._id || !appt?.sellerId?._id) return { buyerRole: null, sellerRole: null };

    const normalizeId = (val) => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (val._id) return val._id.toString();
      return val.toString?.() || null;
    };

    const callerId = normalizeId(activeLiveCall.callerId);
    const receiverId = normalizeId(activeLiveCall.receiverId);
    const buyerId = normalizeId(appt.buyerId);
    const sellerId = normalizeId(appt.sellerId);

    let buyerRole = null;
    let sellerRole = null;

    if (callerId && receiverId && buyerId && sellerId) {
      if (callerId === buyerId && receiverId === sellerId) {
        buyerRole = 'caller';
        sellerRole = 'receiver';
      } else if (callerId === sellerId && receiverId === buyerId) {
        buyerRole = 'receiver';
        sellerRole = 'caller';
      }
    }

    return { buyerRole, sellerRole };
  }, [activeLiveCall, appt]);

  // Attach monitor streams to video elements
  React.useEffect(() => {
    if (buyerMonitorVideoRef.current) {
      if (buyerMonitorStream) {
        if (buyerMonitorVideoRef.current.srcObject !== buyerMonitorStream) {
          buyerMonitorVideoRef.current.srcObject = buyerMonitorStream;
        }
        buyerMonitorVideoRef.current.muted = monitorAudioMuted.buyer;
        buyerMonitorVideoRef.current.play().catch((err) => {
          console.error('Error playing buyer monitor stream:', err);
        });
      } else {
        buyerMonitorVideoRef.current.srcObject = null;
      }
    }
  }, [buyerMonitorStream, monitorAudioMuted.buyer]);

  React.useEffect(() => {
    if (sellerMonitorVideoRef.current) {
      if (sellerMonitorStream) {
        if (sellerMonitorVideoRef.current.srcObject !== sellerMonitorStream) {
          sellerMonitorVideoRef.current.srcObject = sellerMonitorStream;
        }
        sellerMonitorVideoRef.current.muted = monitorAudioMuted.seller;
        sellerMonitorVideoRef.current.play().catch((err) => {
          console.error('Error playing seller monitor stream:', err);
        });
      } else {
        sellerMonitorVideoRef.current.srcObject = null;
      }
    }
  }, [sellerMonitorStream, monitorAudioMuted.seller]);

  const cleanupMonitorPeers = React.useCallback(() => {
    Object.keys(monitorPeersRef.current).forEach((role) => {
      const peer = monitorPeersRef.current[role];
      if (peer) {
        try {
          peer.destroy();
        } catch (err) {
          console.error('[Admin Monitor] Error destroying peer for role', role, err);
        }
        monitorPeersRef.current[role] = null;
      }
    });
    setBuyerMonitorStream(null);
    setSellerMonitorStream(null);
    setMonitorCallId(null);
    setFocusedMonitorView(null);
    setMonitorAudioMuted({ buyer: true, seller: true });
    setMonitorVideoHidden({ buyer: false, seller: false });
    setScreenSharingStatus({ buyer: false, seller: false });
    setParticipantMediaStatus({
      buyer: { isMuted: false, isVideoEnabled: true },
      seller: { isMuted: false, isVideoEnabled: true }
    });
  }, [setBuyerMonitorStream, setSellerMonitorStream, setMonitorCallId, setFocusedMonitorView, setMonitorAudioMuted, setMonitorVideoHidden, setScreenSharingStatus, setParticipantMediaStatus]);

  // Listen for monitor signaling events relevant to this appointment
  React.useEffect(() => {
    if (!socket) return;

    const handleAdminMonitorStarted = ({ callId, appointmentId, callerState, receiverState }) => {
      if (!appt?._id || appointmentId !== appt._id.toString()) return;
      setMonitorCallId(callId);

      // Initialize media states from callerState and receiverState
      const buyerRole = monitorRoles.buyerRole;
      const sellerRole = monitorRoles.sellerRole;

      if (buyerRole && sellerRole) {
        const buyerState = buyerRole === 'caller' ? callerState : receiverState;
        const sellerState = sellerRole === 'caller' ? callerState : receiverState;

        if (buyerState) {
          setParticipantMediaStatus(prev => ({
            ...prev,
            buyer: {
              isMuted: buyerState.isMuted || false,
              isVideoEnabled: buyerState.isVideoEnabled !== false
            }
          }));
          setScreenSharingStatus(prev => ({
            ...prev,
            buyer: buyerState.isScreenSharing || false
          }));
        }

        if (sellerState) {
          setParticipantMediaStatus(prev => ({
            ...prev,
            seller: {
              isMuted: sellerState.isMuted || false,
              isVideoEnabled: sellerState.isVideoEnabled !== false
            }
          }));
          setScreenSharingStatus(prev => ({
            ...prev,
            seller: sellerState.isScreenSharing || false
          }));
        }
      }
    };

    const handleMonitorOffer = ({ callId, fromRole, offer }) => {
      if (!showLiveMonitorModal || !activeLiveCall || callId !== activeLiveCall.callId) return;
      const role = fromRole === 'caller' ? 'caller' : 'receiver';

      let peer = monitorPeersRef.current[role];
      if (!peer) {
        // Admin is non-initiator; we only receive streams
        peer = new SimplePeer({
          initiator: false,
          trickle: true,
          config: {
            iceServers: MONITOR_STUN_SERVERS
          }
        });

        peer.on('signal', (data) => {
          if (data.type === 'answer') {
            socket.emit('webrtc-answer-monitor', {
              callId,
              targetRole: role,
              answer: data
            });
          } else if (data.type === 'candidate') {
            socket.emit('ice-candidate-monitor', {
              callId,
              candidate: data,
              from: 'admin',
              targetRole: role
            });
          }
        });

        peer.on('stream', (remoteStream) => {
          if (role === monitorRoles.buyerRole) {
            setBuyerMonitorStream(remoteStream);
          } else if (role === monitorRoles.sellerRole) {
            setSellerMonitorStream(remoteStream);
          }
        });

        // Listen for data channel messages (status updates)
        peer.on('data', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'status-update') {
              if (role === monitorRoles.buyerRole) {
                setScreenSharingStatus(prev => ({ ...prev, buyer: msg.isScreenSharing }));
              } else if (role === monitorRoles.sellerRole) {
                setScreenSharingStatus(prev => ({ ...prev, seller: msg.isScreenSharing }));
              }
            }
          } catch (err) {
            console.error('[Admin Monitor] Error parsing data channel message:', err);
          }
        });

        peer.on('error', (err) => {
          // Ignore errors that happen during cleanup/destroy
          if (err?.message && (err.message.includes('User-Initiated Abort') || err.message.includes('Close called'))) {
            return;
          }
          console.error('[Admin Monitor] Peer error for role', role, err);
        });

        peer.on('close', () => {
          if (role === 'caller' || role === 'receiver') {
            if (role === monitorRoles.buyerRole) setBuyerMonitorStream(null);
            if (role === monitorRoles.sellerRole) setSellerMonitorStream(null);
          }
          monitorPeersRef.current[role] = null;
        });

        monitorPeersRef.current[role] = peer;
      }

      try {
        peer.signal(offer);
      } catch (err) {
        console.error('[Admin Monitor] Error signaling offer to peer for role', role, err);
      }
    };

    const handleMonitorICECandidate = ({ callId, fromRole, candidate }) => {
      if (!showLiveMonitorModal || !activeLiveCall || callId !== activeLiveCall.callId) return;
      const role = fromRole === 'caller' ? 'caller' : 'receiver';
      const peer = monitorPeersRef.current[role];
      if (peer && candidate) {
        try {
          peer.signal(candidate);
        } catch (err) {
          console.error('[Admin Monitor] Error signaling ICE candidate for role', role, err);
        }
      }
    };

    const handleCallEndedForMonitor = ({ callId }) => {
      if (!activeLiveCall || callId !== activeLiveCall.callId) return;
      cleanupMonitorPeers();
    };

    const handleMonitorError = ({ message }) => {
      // Handle specific error when peers are not ready
      if (message && message.toLowerCase().includes('call peers are not ready for monitoring')) {
        console.warn('[Admin Monitor] Peers not ready:', message);
        // Do not show error toast and do not close modal
        // But ensure monitoring state is cleared so it shows "Not Live"
        cleanupMonitorPeers();
        return;
      }

      console.error('[Admin Monitor] Error:', message);
      // Wrap in setTimeout to avoid potential race conditions with toast removal/updates
      setTimeout(() => {
        toast.error(message || 'Unable to start live monitor for this call.');
      }, 0);
      cleanupMonitorPeers();
      setShowLiveMonitorModal(false);
    };

    const handleRemoteStatusUpdateForMonitor = ({ callId, isMuted, isVideoEnabled, isScreenSharing, fromRole }) => {
      if (!activeLiveCall || callId !== activeLiveCall.callId) return;

      const buyerRole = monitorRoles.buyerRole;
      const sellerRole = monitorRoles.sellerRole;

      if (fromRole === buyerRole) {
        if (isMuted !== undefined || isVideoEnabled !== undefined) {
          setParticipantMediaStatus(prev => ({
            ...prev,
            buyer: {
              isMuted: isMuted !== undefined ? isMuted : prev.buyer.isMuted,
              isVideoEnabled: isVideoEnabled !== undefined ? isVideoEnabled : prev.buyer.isVideoEnabled
            }
          }));
        }
        if (isScreenSharing !== undefined) {
          setScreenSharingStatus(prev => ({ ...prev, buyer: isScreenSharing }));
        }
      } else if (fromRole === sellerRole) {
        if (isMuted !== undefined || isVideoEnabled !== undefined) {
          setParticipantMediaStatus(prev => ({
            ...prev,
            seller: {
              isMuted: isMuted !== undefined ? isMuted : prev.seller.isMuted,
              isVideoEnabled: isVideoEnabled !== undefined ? isVideoEnabled : prev.seller.isVideoEnabled
            }
          }));
        }
        if (isScreenSharing !== undefined) {
          setScreenSharingStatus(prev => ({ ...prev, seller: isScreenSharing }));
        }
      }
    };

    socket.on('admin-monitor-started', handleAdminMonitorStarted);
    socket.on('webrtc-offer-monitor', handleMonitorOffer);
    socket.on('ice-candidate-monitor', handleMonitorICECandidate);
    socket.on('call-ended', handleCallEndedForMonitor);
    socket.on('call-monitor-error', handleMonitorError);
    socket.on('remote-status-update', handleRemoteStatusUpdateForMonitor);

    return () => {
      socket.off('admin-monitor-started', handleAdminMonitorStarted);
      socket.off('webrtc-offer-monitor', handleMonitorOffer);
      socket.off('ice-candidate-monitor', handleMonitorICECandidate);
      socket.off('call-ended', handleCallEndedForMonitor);
      socket.off('call-monitor-error', handleMonitorError);
      socket.off('remote-status-update', handleRemoteStatusUpdateForMonitor);
      cleanupMonitorPeers();
    };
  }, [appt?._id, activeLiveCall, showLiveMonitorModal, MONITOR_STUN_SERVERS, cleanupMonitorPeers, setMonitorCallId, setShowLiveMonitorModal, monitorRoles, setScreenSharingStatus, setParticipantMediaStatus]);

  React.useEffect(() => {
    if (!showLiveMonitorModal) {
      cleanupMonitorPeers();
    }
  }, [showLiveMonitorModal, cleanupMonitorPeers]);

  React.useEffect(() => {
    if (!activeLiveCall) {
      setFocusedMonitorView(null);
    }
  }, [activeLiveCall, setFocusedMonitorView]);

  React.useEffect(() => {
    if (!socket) return;

    const handleForceEndSuccess = ({ callId }) => {
      setForceTerminateLoading(false);
      setShowForceTerminateModal(false);
      if (monitorCallId && callId === monitorCallId) {
        toast.success('Live call terminated successfully.');
        setShowLiveMonitorModal(false);
        cleanupMonitorPeers();
      }
    };

    const handleForceEndError = ({ message }) => {
      setForceTerminateLoading(false);
      setTimeout(() => {
        toast.error(message || 'Failed to terminate live call.');
      }, 0);
    };

    socket.on('call-force-end-success', handleForceEndSuccess);
    socket.on('call-force-end-error', handleForceEndError);
    return () => {
      socket.off('call-force-end-success', handleForceEndSuccess);
      socket.off('call-force-end-error', handleForceEndError);
    };
  }, [socket, monitorCallId, cleanupMonitorPeers, setShowLiveMonitorModal, setForceTerminateLoading, setShowForceTerminateModal]);

  React.useEffect(() => {
    if (!showChatModal) {
      setShowPasswordModal(false);
      setAdminPassword("");
      setPasswordError("");
    }
  }, [showChatModal, setShowPasswordModal, setAdminPassword, setPasswordError]);
  // Persist draft per appointment when chat is open
  React.useEffect(() => {
    if (!showChatModal || !appt?._id || !currentUser?._id) return;

    const fetchDraftAndHandleUrl = async () => {
      const searchParams = new URLSearchParams(location.search);
      const messageParam = searchParams.get('message');
      const draftKey = `admin_appt_draft_${appt._id}_${currentUser._id}`;

      let finalDraft = "";

      // 1. Check URL parameter (highest priority)
      if (messageParam && params.chatId === appt._id) {
        finalDraft = messageParam;
        localStorage.setItem(draftKey, messageParam);
        // Sync URL message to backend immediately
        authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/draft`, {
          method: 'PATCH',
          body: JSON.stringify({ draft: messageParam })
        }).catch(err => console.error('Failed to sync URL message to admin backend draft:', err));
      } else {
        // 2. Check localStorage
        const saved = localStorage.getItem(draftKey);
        if (saved !== null && saved !== undefined && saved !== "") {
          finalDraft = saved;
        } else {
          // 3. Check backend database (lowest priority fallback)
          try {
            // Appt should have adminDraft if it was recently fetched/populated
            if (appt.adminDraft) {
              finalDraft = appt.adminDraft;
              localStorage.setItem(draftKey, appt.adminDraft);
            }
          } catch (err) {
            console.error('Failed to get admin draft from appointment:', err);
          }
        }
      }

      if (finalDraft) {
        setNewComment(finalDraft);
        setTimeout(() => {
          try {
            if (inputRef.current) {
              const length = inputRef.current.value.length;
              inputRef.current.setSelectionRange(length, length);
              autoResizeTextarea(inputRef.current);
            }
          } catch (_) { }
        }, 0);
      }
    };

    fetchDraftAndHandleUrl();
  }, [showChatModal, appt?._id, currentUser?._id, location.search, params.chatId]);

  // Sync draft to backend as admin types (debounced)
  React.useEffect(() => {
    if (!showChatModal || !appt?._id || !currentUser?._id) return;
    
    const timeoutId = setTimeout(() => {
      const draftKey = `admin_appt_draft_${appt._id}_${currentUser._id}`;
      localStorage.setItem(draftKey, newComment);
      
      authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ draft: newComment })
      }).catch(err => console.error('Failed to sync admin draft to backend:', err));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [newComment, showChatModal, appt?._id, currentUser?._id]);

  // Starred messages states
  const [showStarredModal, setShowStarredModal] = useLocalState(false);
  const [starredMessages, setStarredMessages] = useLocalState([]);
  const [loadingStarredMessages, setLoadingStarredMessages] = useLocalState(false);
  const [starringSaving, setStarringSaving] = useLocalState(false);
  const [unstarringMessageId, setUnstarringMessageId] = useLocalState(null);
  const [removingAllStarred, setRemovingAllStarred] = useLocalState(false);
  const [sendIconAnimating, setSendIconAnimating] = useLocalState(false);
  const [sendIconSent, setSendIconSent] = useLocalState(false);

  // Chat options menu state
  const [showChatOptionsMenu, setShowChatOptionsMenu] = useLocalState(false);
  const { settings, updateSetting } = useChatSettings('admin_appointments_chat_settings');
  const isDarkMode = settings.theme === 'dark';
  const [showSettingsModal, setShowSettingsModal] = useLocalState(false);

  // Text styling panel state
  const [showTextStylingPanel, setShowTextStylingPanel] = useLocalState(false);

  // Helper function to apply formatting and close panel
  const applyFormattingAndClose = (formatFunction) => {
    formatFunction();
    setTimeout(() => setShowTextStylingPanel(false), 100); // Small delay for better UX
  };

  // Multi-select message states
  const [isSelectionMode, setIsSelectionMode] = useLocalState(false);
  const [selectedMessages, setSelectedMessages] = useLocalState([]);
  const [multiSelectActions, setMultiSelectActions] = useLocalState({
    starring: false,
    copying: false,
    deleting: false
  });

  // Removed pinning feature state

  // Search functionality state
  const [showSearchBox, setShowSearchBox] = useLocalState(false);
  const [searchQuery, setSearchQuery] = useLocalState("");
  const [searchResults, setSearchResults] = useLocalState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useLocalState(-1);

  // Calendar functionality state
  const [showCalendar, setShowCalendar] = useLocalState(false);
  const [selectedDate, setSelectedDate] = useLocalState("");
  const [highlightedDateMessage, setHighlightedDateMessage] = useLocalState(null);

  // File upload states
  const [uploadingFile, setUploadingFile] = useLocalState(false);
  const [fileUploadError, setFileUploadError] = useLocalState('');
  const [selectedFiles, setSelectedFiles] = useLocalState([]);
  const [showImagePreview, setShowImagePreview] = useLocalState(false);
  const [previewImages, setPreviewImages] = useLocalState([]);
  const [previewIndex, setPreviewIndex] = useLocalState(0);
  const [imageCaptions, setImageCaptions] = useLocalState({});
  const [showImagePreviewModal, setShowImagePreviewModal] = useLocalState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Enhanced upload tracking
  const [currentFileIndex, setCurrentFileIndex] = useLocalState(-1);
  const [currentFileProgress, setCurrentFileProgress] = useLocalState(0);
  const [failedFiles, setFailedFiles] = useLocalState([]);
  const [isCancellingUpload, setIsCancellingUpload] = useLocalState(false);
  const currentUploadControllerRef = React.useRef(null);
  const videoCaptionRef = React.useRef(null);
  const documentCaptionRef = React.useRef(null);
  const videoInputRef = React.useRef(null);
  const documentInputRef = React.useRef(null);
  const attachmentButtonRef = React.useRef(null);
  const attachmentPanelRef = React.useRef(null);
  // New media states
  const [showAttachmentPanel, setShowAttachmentPanel] = useLocalState(false);
  const [selectedVideo, setSelectedVideo] = useLocalState(null);
  const [showVideoPreviewModal, setShowVideoPreviewModal] = useLocalState(false);
  const [selectedDocument, setSelectedDocument] = useLocalState(null);
  const [showDocumentPreviewModal, setShowDocumentPreviewModal] = useLocalState(false);
  const [videoCaption, setVideoCaption] = useLocalState('');
  const [documentCaption, setDocumentCaption] = useLocalState('');
  const [videoObjectURL, setVideoObjectURL] = useLocalState(null);
  const [selectedAudio, setSelectedAudio] = useLocalState(null);
  const [showAudioPreviewModal, setShowAudioPreviewModal] = useLocalState(false);
  const [audioCaption, setAudioCaption] = useLocalState('');
  const [audioObjectURL, setAudioObjectURL] = useLocalState(null);
  const audioCaptionRef = React.useRef(null);

  // Audio Recording states (parity with MyAppointments)
  const [showRecordAudioModal, setShowRecordAudioModal] = useLocalState(false);
  const [isRecording, setIsRecording] = useLocalState(false);
  const [isPaused, setIsPaused] = useLocalState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = useLocalState(0);
  const [recordingStream, setRecordingStream] = useLocalState(null);
  const mediaRecorderRef = React.useRef(null);
  const recordingChunksRef = React.useRef([]);
  const recordingTimerRef = React.useRef(null);
  const recordingStartTimeRef = React.useRef(0);
  const recordingCancelledRef = React.useRef(false);
  const pausedTimeRef = React.useRef(0); // Total time spent paused

  // Manage video object URL to prevent reloading on each keystroke
  React.useEffect(() => {
    if (selectedVideo) {
      const url = URL.createObjectURL(selectedVideo);
      setVideoObjectURL(url);
      return () => {
        URL.revokeObjectURL(url);
        setVideoObjectURL(null);
      };
    } else {
      setVideoObjectURL(null);
    }
  }, [selectedVideo]);

  // Manage audio object URL
  React.useEffect(() => {
    if (selectedAudio) {
      const url = URL.createObjectURL(selectedAudio);
      setAudioObjectURL(url);
      return () => {
        URL.revokeObjectURL(url);
        setAudioObjectURL(null);
      };
    } else {
      setAudioObjectURL(null);
    }
  }, [selectedAudio]);

  // Ensure timer ticks reliably while recording (redundant guard)
  React.useEffect(() => {
    if (isRecording && !isPaused) {
      // Initialize start time if not set
      if (!recordingStartTimeRef.current) {
        recordingStartTimeRef.current = Date.now();
      }
      const id = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current - pausedTimeRef.current;
        setRecordingElapsedMs(elapsed);
      }, 500);
      return () => clearInterval(id);
    }
  }, [isRecording, isPaused]);

  // Recording timer cleanup
  React.useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingStream) recordingStream.getTracks().forEach(t => t.stop());
    };
  }, [recordingStream]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
      recordingChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        try {
          if (recordingCancelledRef.current) {
            // Do not create file or open preview when cancelled
            return;
          }
          const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
          const fileName = `recording-${Date.now()}.webm`;
          const file = new File([blob], fileName, { type: 'audio/webm' });
          setSelectedAudio(file);
          setShowRecordAudioModal(false);
          setShowAudioPreviewModal(true);
        } catch (err) {
          toast.error('Failed to prepare audio preview');
        } finally {
          if (recordingStream) recordingStream.getTracks().forEach(t => t.stop());
          setRecordingStream(null);
          setIsRecording(false);
          setIsPaused(false);
          setRecordingElapsedMs(0);
          pausedTimeRef.current = 0;
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          recordingStartTimeRef.current = 0;
          recordingCancelledRef.current = false;
        }
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      setRecordingElapsedMs(0);
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current - pausedTimeRef.current;
        setRecordingElapsedMs(elapsed);
      }, 500);
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Microphone permission denied or unavailable');
    }
  };

  const stopAudioRecording = () => {
    if (!mediaRecorderRef.current) return;
    try {
      mediaRecorderRef.current.stop();
    } catch { }
  };

  const pauseAudioRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    try {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      // Clear the timer when pausing
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } catch (err) {
      console.error('Pause recording error:', err);
    }
  };

  const resumeAudioRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'paused') return;
    try {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      // Update paused time accumulator
      const pauseEndTime = Date.now();
      const pauseStartTime = recordingStartTimeRef.current + recordingElapsedMs + pausedTimeRef.current;
      pausedTimeRef.current += (pauseEndTime - pauseStartTime);

      // Restart the timer
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current - pausedTimeRef.current;
        setRecordingElapsedMs(elapsed);
      }, 500);
    } catch (err) {
      console.error('Resume recording error:', err);
    }
  };

  const cancelAudioRecording = () => {
    try {
      recordingCancelledRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch { }
    if (recordingStream) recordingStream.getTracks().forEach(t => t.stop());
    setRecordingStream(null);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingElapsedMs(0);
    pausedTimeRef.current = 0;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setShowRecordAudioModal(false);
    // Ensure preview is not shown and any selection cleared
    setSelectedAudio(null);
  };

  // Close attachment panel on outside click
  React.useEffect(() => {
    if (!showAttachmentPanel) return;
    const handleClickOutside = (e) => {
      const btn = attachmentButtonRef.current;
      const panel = attachmentPanelRef.current;
      if (panel && panel.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      setShowAttachmentPanel(false);
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showAttachmentPanel]);

  // Message selected for header options overlay
  const selectedMessageForHeaderOptions = headerOptionsMessageId && headerOptionsMessageId.startsWith('call-')
    ? null // Call items handled separately
    : (headerOptionsMessageId ? localComments.find(msg => msg._id === headerOptionsMessageId) : null);

  // Call selected for header options overlay
  const selectedCallForHeaderOptions = headerOptionsMessageId && headerOptionsMessageId.startsWith('call-')
    ? callHistory.find(call => `call-${call._id || call.callId}` === headerOptionsMessageId)
    : null;

  // Reactions functions
  const handleQuickReaction = async (messageId, emoji) => {
    try {
      const message = localComments.find(c => c._id === messageId);
      if (!message) {
        toast.error('Message not found');
        return;
      }

      // Add reaction to the message
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageId}/react`, {
        method: 'PATCH',
        body: JSON.stringify({ emoji })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      // Update local state
      setLocalComments(prev => prev.map(c =>
        c._id === messageId
          ? {
            ...c,
            reactions: data.reactions || c.reactions || []
          }
          : c
      ));

      // Update parent component state
      updateAppointmentComments(appt._id, localComments.map(c =>
        c._id === messageId
          ? {
            ...c,
            reactions: data.reactions || c.reactions || []
          }
          : c
      ));

      // Close both the quick reactions model and the reactions bar
      setShowReactionsEmojiPicker(false);
      setShowReactionsBar(false);
      setReactionsMessageId(null);

      toast.success('Reaction added!');

    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add reaction');
    }
  };

  // Lock body scroll when chat modal is open
  React.useEffect(() => {
    if (showChatModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [showChatModal]);

  // Reset unread count when chat modal opens
  React.useEffect(() => {
    if (showChatModal) {
      setUnreadNewMessages(0);
      // Mark messages as read when chat is opened
      markMessagesAsRead(true);

      // Sync starred messages when chat opens
      if (starredMessages.length > 0) {
        // Update starred messages list with current comment states
        const updatedStarredMessages = starredMessages.map(starredMsg => {
          const currentComment = localComments.find(c => c._id === starredMsg._id);
          return currentComment ? { ...starredMsg, starredBy: currentComment.starredBy || [] } : starredMsg;
        }).filter(msg => msg.starredBy && msg.starredBy.includes(currentUser._id));
        setStarredMessages(updatedStarredMessages);
      }
    }
  }, [showChatModal, appt._id, starredMessages.length, localComments, currentUser._id]);

  // Auto-close shortcut tip after 10 seconds
  React.useEffect(() => {
    if (showShortcutTip) {
      const timer = setTimeout(() => {
        setShowShortcutTip(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showShortcutTip]);

  // Lock body scroll when admin password modal is open
  React.useEffect(() => {
    if (showPasswordModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPasswordModal]);

  // Autofocus password input when modal opens (desktop only)
  React.useEffect(() => {
    if (showPasswordModal && !isMobile && passwordInputRef.current) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [showPasswordModal, isMobile]);

  // Ensure password modal closes once chat unlocks - with proper timing
  React.useEffect(() => {
    if (showChatModal && showPasswordModal) {
      // Add small delay to ensure state updates properly
      const timer = setTimeout(() => {
        setShowPasswordModal(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showChatModal]);

  // Emergency modal close trigger - ensure modal doesn't stay open
  React.useEffect(() => {
    if (!showChatModal && showPasswordModal) {
      // Password modal should only be visible if chat is NOT showing
      // This prevents overlap and ensures clean state transitions
      return;
    }
  }, [showChatModal, showPasswordModal]);

  // Handle notification-triggered chat opening (from URL or notification)
  useEffect(() => {
    if (shouldOpenChatFromNotification && activeChatAppointmentId === appt._id) {
      // CRITICAL: Always require password check, even when opening via URL
      // Show password modal first - chat will open after successful verification
      setShowPasswordModal(true);
      setAdminPassword("");
      setPasswordError("");
      // Reset attempts when opening modal
      localStorage.removeItem('adminAppointmentsPwAttempts');
    }
  }, [shouldOpenChatFromNotification, activeChatAppointmentId, appt._id]);

  // Function to fetch starred messages
  const fetchStarredMessages = async () => {
    if (!appt?._id) return;

    setLoadingStarredMessages(true);
    try {
      // First, sync comments to ensure we have the latest starred status
      await loadInitialComments();
      // Then fetch starred messages from backend
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/starred-messages`);
      if (!res.ok) throw new Error('Failed to fetch starred messages');
      const data = await res.json();
      if (data.starredMessages) {
        setStarredMessages(data.starredMessages);
      }
    } catch (err) {
      console.error('Error fetching starred messages:', err);
      toast.error('Failed to load starred messages');
    } finally {
      setLoadingStarredMessages(false);
    }
  };

  // Fetch starred messages when modal opens
  React.useEffect(() => {
    if (showStarredModal) {
      fetchStarredMessages();
    }
  }, [showStarredModal, appt._id]);

  // Function to remove all starred messages
  const handleRemoveAllStarredMessages = async () => {
    if (starredMessages.length === 0) return;

    const messageCount = starredMessages.length; // Store count before clearing
    setRemovingAllStarred(true);

    try {


      // Process messages one by one to handle individual failures gracefully
      let successCount = 0;
      let failureCount = 0;
      const failedMessages = [];

      for (const message of starredMessages) {
        try {


          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/star`, {
            method: 'PATCH',
            body: JSON.stringify({ starred: false })
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw { response: { status: res.status, data: errorData } };
          }
          const data = await res.json();
          const response = { status: 200, data };


          successCount++;

          // Update this specific message in local comments
          setLocalComments(prev => prev.map(c =>
            c._id === message._id
              ? { ...c, starredBy: (c.starredBy || []).filter(id => id !== currentUser._id) }
              : c
          ));

        } catch (err) {
          console.error(`Failed to unstar message ${message._id}:`, err);
          failureCount++;
          failedMessages.push(message);
        }
      }



      // Remove successfully unstarred messages from starred messages list
      setStarredMessages(prev => prev.filter(msg => !failedMessages.some(failed => failed._id === msg._id)));

      // Show appropriate feedback
      if (successCount > 0 && failureCount === 0) {
        toast.success(`Successfully removed ${successCount} starred message${successCount !== 1 ? 's' : ''}`);
        // Close the modal only if all messages were processed successfully
        setShowStarredModal(false);
      } else if (successCount > 0 && failureCount > 0) {
        toast.warning(`Partially successful: ${successCount} messages unstarred, ${failureCount} failed`);
      } else {
        toast.error(`Failed to unstar any messages. Please try again.`);
      }

    } catch (err) {
      console.error('Error removing all starred messages:', err);
      toast.error('Failed to remove all starred messages. Please try again.');
    } finally {
      setRemovingAllStarred(false);
    }
  };

  // Removed pinning initialization

  // Close chat options menu when clicking outside or scrolling
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatOptionsMenu && !event.target.closest('.chat-options-menu')) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu && !event.target.closest('.chat-options-menu')) {
        setShowHeaderMoreMenu(false);
      }
    };

    // Close search box when clicking outside
    const handleSearchClickOutside = (event) => {
      if (showSearchBox && !event.target.closest('.search-container') && !event.target.closest('.enhanced-search-header')) {
        setShowSearchBox(false);
        setSearchQuery("");
        setSearchResults([]);
        setCurrentSearchIndex(-1);
      }
    };

    // Close calendar when clicking outside
    const handleCalendarClickOutside = (event) => {
      if (showCalendar && !event.target.closest('.calendar-container')) {
        setShowCalendar(false);
      }
    };

    // Close reactions when clicking outside
    const handleReactionsClickOutside = (event) => {
      if (showReactionsEmojiPicker && !event.target.closest('.quick-reactions-modal')) {
        setShowReactionsEmojiPicker(false);
      }
      if (showReactionsBar && !event.target.closest('.reactions-bar')) {
        setShowReactionsBar(false);
        setReactionsMessageId(null);
        // Don't close quick reactions model on click outside - only close reaction bar
      }
    };

    const handleScroll = () => {
      if (showChatOptionsMenu) {
        setShowChatOptionsMenu(false);
      }
      if (showHeaderMoreMenu) {
        setShowHeaderMoreMenu(false);
      }
      if (showReactionsBar && !showReactionsEmojiPicker) {
        setShowReactionsBar(false);
        setReactionsMessageId(null);
      }
      // Don't close quick reactions model on scroll - only close reaction bar
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousedown', handleSearchClickOutside);
    document.addEventListener('mousedown', handleCalendarClickOutside);
    document.addEventListener('mousedown', handleReactionsClickOutside);
    document.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scroll events

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleSearchClickOutside);
      document.removeEventListener('mousedown', handleCalendarClickOutside);
      document.removeEventListener('mousedown', handleReactionsClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [showChatOptionsMenu, showHeaderMoreMenu, showSearchBox, showCalendar, showReactionsBar, showReactionsEmojiPicker]);

  // Reset send icon animation after completion
  React.useEffect(() => {
    if (sendIconAnimating) {
      const timer = setTimeout(() => {
        setSendIconAnimating(false);
        setSendIconSent(true);
        // Reset sent state after showing success animation
        const sentTimer = setTimeout(() => setSendIconSent(false), 1000);
        return () => clearTimeout(sentTimer);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [sendIconAnimating]);

  // Handle search result navigation
  React.useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex]) {
      scrollToSearchResult(searchResults[currentSearchIndex]._id);
    }
  }, [currentSearchIndex, searchResults]);

  // Removed handleClickOutside functionality - options now only close when clicking three dots again

  // Sync localComments with parent comments for real-time updates
  React.useEffect(() => {
    const serverComments = appt.comments || [];

    // CRITICAL FIX: Use ref to track previous server comments length to avoid race conditions
    const prevServerLength = prevServerCommentsLengthRef.current;
    const currentServerLength = serverComments.length;

    // Always merge server comments with local temp messages to ensure consistency
    setLocalComments(prev => {
      const serverCommentIds = new Set(serverComments.map(c => c._id));
      const localTempMessages = prev.filter(c => c._id.startsWith('temp-'));

      // Always start with server comments as the source of truth
      const mergedComments = [...serverComments];

      // Add back any local temp messages that haven't been confirmed yet
      localTempMessages.forEach(tempMsg => {
        if (!serverCommentIds.has(tempMsg._id)) {
          mergedComments.push(tempMsg);
        }
      });

      // Sort by timestamp to maintain chronological order
      mergedComments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return mergedComments;
    });

    // Handle unread message count and auto-scroll for new messages
    if (currentServerLength > prevServerLength) {
      const newMessages = serverComments.slice(prevServerLength);
      const receivedMessages = newMessages.filter(msg => msg.senderEmail !== currentUser.email);

      if (receivedMessages.length > 0) {
        // Increment unread count for messages from other users
        if (!showChatModal) {
          setUnreadNewMessages(prev => prev + receivedMessages.length);
        }

        // Auto-scroll if chat is open and user is at bottom
        if (showChatModal && isAtBottom) {
          setTimeout(() => {
            if (chatEndRef.current) {
              chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
        }

        // Mark messages as read if chat is open
        if (showChatModal) {
          setTimeout(() => {
            authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
              method: 'PATCH',
              body: JSON.stringify({})
            }).catch(err => {
              console.error('Error marking messages as read:', err);
            });
          }, 100);
        }
      }
    }

    // Update the ref with current server comments length for next comparison
    prevServerCommentsLengthRef.current = currentServerLength;
  }, [appt.comments, appt._id, showChatModal, isAtBottom, currentUser.email]);

  // Initialize prevServerCommentsLengthRef when component mounts or chatbox opens
  React.useEffect(() => {
    if (showChatModal) {
      // Initialize ref with current server comments length when chatbox opens
      const serverComments = appt.comments || [];
      prevServerCommentsLengthRef.current = serverComments.length;
    }
  }, [showChatModal, appt._id]);

  // Load reported ids when chat opens for this appointment
  React.useEffect(() => {
    if (showChatModal && appt?._id) {
      fetchReportedMessageIds(appt._id);
    }
  }, [showChatModal, appt?._id]);

  // Fetch call history for appointment when chat modal opens
  React.useEffect(() => {
    if (!showChatModal || !appt?._id) return;

    const fetchCallHistory = async () => {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/history/${appt._id}`);

        if (response.ok) {
          const data = await response.json();
          if (data.calls) {
            setCallHistory(data.calls);
          }
        }
      } catch (error) {
        console.error('Error fetching call history:', error);
      }
    };

    fetchCallHistory();
  }, [showChatModal, appt?._id]);

  // Listen for call-ended event to update call history in real-time
  React.useEffect(() => {
    if (!appt?._id) return;

    const fetchCallHistory = async () => {
      if (!appt?._id) return;
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/history/${appt._id}`);

        if (response.ok) {
          const data = await response.json();
          if (data.calls) {
            setCallHistory(data.calls);
          }
        }
      } catch (error) {
        console.error('Error fetching call history:', error);
      }
    };

    const handleCallEnded = (data) => {
      // If this call belongs to this appointment, refetch call history immediately
      // This ensures call bubbles appear in real-time like regular messages
      if (data.appointmentId && data.appointmentId !== appt._id) return;

      if (data.callId) {
        // Small delay to ensure backend has saved the call
        setTimeout(() => {
          fetchCallHistory();
        }, 100);
      }
    };

    socket.on('call-ended', handleCallEnded);
    socket.on('call-initiated', handleCallEnded); // Reuse handler to refresh history
    socket.on('call-accepted', handleCallEnded);  // Reuse handler to refresh history

    return () => {
      socket.off('call-ended', handleCallEnded);
      socket.off('call-initiated', handleCallEnded);
      socket.off('call-accepted', handleCallEnded);
    };
  }, [appt?._id, socket]);

  // Handle auto-closing of force terminate modal when call ends
  useEffect(() => {
    if (forceTerminateLoading && !activeLiveCall) {
      setShowForceTerminateModal(false);
      setForceTerminateLoading(false);
      setForceTerminateReason('');
      toast.success('Live call terminated successfully.');
    }
  }, [activeLiveCall, forceTerminateLoading]);

  // Auto-scroll to bottom when chat modal opens
  React.useEffect(() => {
    if (showChatModal) {
      // Multiple attempts to ensure complete scroll to bottom
      const scrollToCompleteBottom = () => {
        // Method 1: Direct scroll to bottom using scrollTop
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }

        // Method 2: Also use scrollIntoView as backup
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
      };

      // Immediate scroll
      scrollToCompleteBottom();

      // Delayed scroll to ensure DOM is fully rendered
      setTimeout(scrollToCompleteBottom, 100);

      // Final scroll after comments are loaded
      setTimeout(scrollToCompleteBottom, 300);
    }
  }, [showChatModal]);

  // Increase visible messages when scrolled to top
  React.useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const onScrollTopLoadMore = () => {
      if (container.scrollTop <= 30 && localComments.length > visibleCount && !loadingOlderRef.current) {
        loadingOlderRef.current = true;
        setIsLoadingOlderMessages(true);
        const prevHeight = container.scrollHeight;
        // Small delay to show spinner before rendering more items
        setTimeout(() => {
          setVisibleCount(prev => Math.min(prev + MESSAGES_PAGE_SIZE, localComments.length));
          // Maintain scroll position after increasing items
          requestAnimationFrame(() => {
            if (container) {
              const newHeight = container.scrollHeight;
              container.scrollTop = newHeight - prevHeight;
            }
            setIsLoadingOlderMessages(false);
            // Debounce: prevent rapid consecutive loads
            setTimeout(() => {
              loadingOlderRef.current = false;
            }, 300);
          });
        }, 150);
      }
    };
    container.addEventListener('scroll', onScrollTopLoadMore);
    return () => container.removeEventListener('scroll', onScrollTopLoadMore);
  }, [localComments.length, visibleCount]);

  // Reset visible count when opening chat or switching appointments
  React.useEffect(() => {
    setVisibleCount(MESSAGES_PAGE_SIZE);
  }, [appt._id, showChatModal]);



  // Track new messages and handle auto-scroll/unread count
  const prevCommentsLengthRef = React.useRef(localComments.length);
  const prevCommentsRef = React.useRef(localComments);
  React.useEffect(() => {
    const newMessages = localComments.slice(prevCommentsLengthRef.current);
    const newMessagesCount = newMessages.length;
    prevCommentsLengthRef.current = localComments.length;
    prevCommentsRef.current = localComments;

    if (newMessagesCount > 0 && showChatModal) {
      // Check if any new messages are from current user (sent messages)
      const hasSentMessages = newMessages.some(msg => msg.senderEmail === currentUser.email);
      // Check if any new messages are from other users (received messages)
      const receivedMessages = newMessages.filter(msg => msg.senderEmail !== currentUser.email);

      if (hasSentMessages || isAtBottom) {
        // Auto-scroll if user sent a message OR if user is at bottom
        setTimeout(() => {
          if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else if (receivedMessages.length > 0) {
        // Add to unread count only for received messages when user is not at bottom
        setUnreadNewMessages(prev => prev + receivedMessages.length);
      }
    }
  }, [localComments.length, isAtBottom, showChatModal, currentUser.email]);

  // Additional scroll to bottom when comments are initially loaded
  React.useEffect(() => {
    if (showChatModal && localComments.length > 0) {
      // Ensure scroll to bottom after comments are loaded
      setTimeout(() => {
        if (chatContainerRef.current && chatEndRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 200);
    }
  }, [showChatModal, localComments.length]);

  // Reset unread count when chat modal is opened or closed
  React.useEffect(() => {
    if (showChatModal) {
      // Reset count when chat opens
      setUnreadNewMessages(0);
    } else {
      // Also reset when chat closes
      setUnreadNewMessages(0);
    }
  }, [showChatModal]);

  // Function to update floating date based on visible messages
  const updateFloatingDate = React.useCallback(() => {
    if (!chatContainerRef.current || localComments.length === 0) return;

    const container = chatContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top + 60; // Account for header

    // Find the first visible message
    let visibleDate = '';
    for (let i = 0; i < localComments.length; i++) {
      const messageElement = messageRefs.current[localComments[i]._id];
      if (messageElement) {
        const messageRect = messageElement.getBoundingClientRect();
        if (messageRect.top >= containerTop && messageRect.bottom <= containerRect.bottom) {
          const messageDate = new Date(localComments[i].timestamp);
          visibleDate = getDateLabel(messageDate);
          break;
        }
      }
    }

    // If no message is fully visible, find the one that's partially visible at the top
    if (!visibleDate) {
      for (let i = 0; i < localComments.length; i++) {
        const messageElement = messageRefs.current[localComments[i]._id];
        if (messageElement) {
          const messageRect = messageElement.getBoundingClientRect();
          if (messageRect.bottom > containerTop) {
            const messageDate = new Date(localComments[i].timestamp);
            visibleDate = getDateLabel(messageDate);
            break;
          }
        }
      }
    }

    if (visibleDate && visibleDate !== currentFloatingDate) {
      setCurrentFloatingDate(visibleDate);
    }
  }, [localComments, currentFloatingDate]);

  // Mark messages as read when user can see them
  const markingReadRef = React.useRef(false);

  const markMessagesAsRead = React.useCallback(async (force = false) => {
    if (!appt?._id) return;

    // Check if we are close to bottom (generous 150px threshold)
    if (!force && chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isCloseToBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (!isCloseToBottom) return;
    }

    if (markingReadRef.current) return; // Prevent concurrent requests

    const unreadMessages = localComments.filter(c =>
      !c.readBy?.includes(currentUser._id) &&
      c.senderEmail !== currentUser.email
    );

    if (unreadMessages.length > 0) {
      markingReadRef.current = true;
      try {
        // Mark messages as read in backend
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/read`, {
          method: 'PATCH',
          body: JSON.stringify({})
        });
        if (!res.ok) {
          // We can swallow the error here or log it, but proceeding is fine
          // The catch block below will handle it
        }
        const data = await res.json();
        // Update local state immediately
        setLocalComments(prev =>
          prev.map(c =>
            unreadMessages.some(unread => unread._id === c._id)
              ? { ...c, readBy: [...(c.readBy || []), currentUser._id], status: 'read' }
              : c
          )
        );


      } catch (error) {
        console.error('Error marking messages as read:', error);
      } finally {
        markingReadRef.current = false;
      }
    }
  }, [localComments, currentUser._id, appt._id, socket]);

  // Check if user is at the bottom of chat
  const checkIfAtBottom = React.useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 5; // 5px threshold
      setIsAtBottom(atBottom);

      // Clear unread count and mark messages as read when user reaches bottom
      if (atBottom) {
        // Check if there are actually unread messages irrespective of unreadNewMessages counter
        const hasUnread = localComments.some(c =>
          !c.readBy?.includes(currentUser._id) && c.senderEmail !== currentUser.email
        );

        if (hasUnread) {
          setUnreadNewMessages(0);
          markMessagesAsRead();
        } else if (unreadNewMessages > 0) {
          setUnreadNewMessages(0);
        }
      }
    }
  }, [unreadNewMessages, markMessagesAsRead, localComments, currentUser._id]);

  // Add scroll event listener for chat container
  React.useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer && showChatModal) {
      const handleScroll = () => {
        checkIfAtBottom();
        updateFloatingDate();

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

      chatContainer.addEventListener('scroll', handleScroll);
      // Check initial position
      checkIfAtBottom();

      // Initialize floating date
      setTimeout(updateFloatingDate, 100);

      return () => {
        chatContainer.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [showChatModal, checkIfAtBottom, updateFloatingDate]);

  // Function to scroll to bottom
  const scrollToBottom = React.useCallback(() => {
    // Clear unread count immediately
    setUnreadNewMessages(0);

    // Use multiple methods to ensure scroll works
    setTimeout(() => {
      if (chatContainerRef.current) {
        // Method 1: Scroll the container to bottom
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }

      // Method 2: Also use scrollIntoView as backup
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }

      // Mark messages as read after scrolling
      setTimeout(() => {
        markMessagesAsRead();
      }, 500); // Wait for scroll animation to complete
    }, 100); // Small delay to ensure DOM is updated
  }, [markMessagesAsRead]);

  // Lock background scroll when chat modal is open
  React.useEffect(() => {
    if (showChatModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      markMessagesAsRead(true);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showChatModal, appt._id, markMessagesAsRead]);

  // Note: Toast notifications for new messages removed for admin interface
  // Admins don't need popup notifications as they manage messages proactively

  // Chat clearing and message removal events (keeping only these, parent handles commentUpdate)
  React.useEffect(() => {
    function handleChatClearedForUser({ appointmentId, clearedAt, userId }) {
      if (appointmentId !== appt._id) return;
      // Only clear if WE (admin) cleared it
      if (userId === currentUser._id) {
        setLocalComments([]);
        setUnreadNewMessages(0);
        setShowReactionsBar(false);
        setReactionsMessageId(null);
      }
    }

    function handleCommentRemovedForUser({ appointmentId, commentId, userId }) {
      if (appointmentId !== appt._id) return;
      // Only remove if WE (admin) removed it for ourselves
      if (userId === currentUser._id) {
        setLocalComments(prev => prev.filter(c => c._id !== commentId));
        setShowReactionsBar(false);
        setReactionsMessageId(null);
      }
    }

    socket.on('chatClearedForUser', handleChatClearedForUser);
    socket.on('commentRemovedForUser', handleCommentRemovedForUser);
    return () => {
      socket.off('chatClearedForUser', handleChatClearedForUser);
      socket.off('commentRemovedForUser', handleCommentRemovedForUser);
    };
  }, [appt._id]);

  React.useEffect(() => {
    const handleCommentDelivered = (data) => {
      if (data.appointmentId === appt._id) {
        setLocalComments(prev =>
          prev.map(c =>
            c._id === data.commentId
              ? { ...c, status: c.status === "read" ? "read" : "delivered", deliveredAt: new Date() }
              : c
          )
        );
      }
    };

    const handleCommentRead = (data) => {
      if (data.appointmentId === appt._id) {
        setLocalComments(prev =>
          prev.map(c =>
            !c.readBy?.includes(data.userId)
              ? { ...c, status: "read", readBy: [...(c.readBy || []), data.userId], readAt: new Date() }
              : c
          )
        );
      }
    };

    const handleChatCleared = (data) => {
      if (data.appointmentId === appt._id) {
        setLocalComments([]);
        toast.success('Chat deleted by admin');
        // Close reactions bar when chat is cleared
        setShowReactionsBar(false);
        setReactionsMessageId(null);
      }
    };
    socket.on('chatCleared', handleChatCleared);
    socket.on('commentDelivered', handleCommentDelivered);
    socket.on('commentRead', handleCommentRead);

    return () => {
      socket.off('chatCleared', handleChatCleared);
      socket.off('commentDelivered', handleCommentDelivered);
      socket.off('commentRead', handleCommentRead);
    };
  }, [appt._id, showChatModal, currentUser.email, isAtBottom]);

  // Keyboard shortcut Ctrl+F to focus message input
  React.useEffect(() => {
    if (!showChatModal) return;

    // Focus input when chat modal opens (desktop only)
    const focusInput = () => {
      if (inputRef.current && !isMobile) {
        // Use focusWithoutKeyboard to prevent keyboard from opening on mobile
        focusWithoutKeyboard(inputRef.current, inputRef.current.value.length);
      }
    };

    // Focus input after a short delay to ensure modal is fully rendered (desktop only)
    if (!isMobile) {
      setTimeout(focusInput, 100);
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowChatModal(false);
        if (params.chatId) {
          navigate('/admin/appointments', { replace: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChatModal]);

  // Lazy-load global content (properties, blogs, guides) when user starts typing a mention
  React.useEffect(() => {
    if (!showChatModal) return;
    const hasMentionTrigger = /@[^\s]*$/.test(newComment || "");
    if (!hasMentionTrigger) return;

    // Load properties if not already loaded
    if (!propertiesLoaded) {
      (async () => {
        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=300`);
          const data = await res.json();
          const mapped = Array.isArray(data) ? data.map(l => ({
            id: l._id,
            name: l.name || 'Property',
            city: l.city,
            state: l.state,
            price: l.discountPrice || l.regularPrice || l.price || 0,
            bedrooms: l.bedrooms || 0,
            bathrooms: l.bathrooms || 0,
            area: l.area || 0,
            imageUrls: l.imageUrls || [],
            imageUrl: l.imageUrl,
            image: l.image,
            thumbnail: l.thumbnail,
            type: 'property'
          })) : [];
          setAllProperties(mapped);
          setPropertiesLoaded(true);
        } catch (_) {
          // ignore failures
        }
      })();
    }

    // Load blogs if not already loaded
    if (!blogsLoaded) {
      (async () => {
        try {
          setIsLoadingBlogSuggestions(true);
          const res = await authenticatedFetch(`${API_BASE_URL}/api/blogs?limit=300&type=all&published=true`);
          const data = await res.json();
          const mapped = (data.data || data || []).map(b => ({
            id: b._id,
            name: b.title || 'Blog',
            category: b.category || 'General',
            image: b.thumbnail || b.image || null,
            type: b.type || 'blog'
          }));
          setAllBlogs(mapped);
          setBlogsLoaded(true);
        } catch (_) {
          // ignore failures
        } finally {
          setIsLoadingBlogSuggestions(false);
        }
      })();
    }
  }, [newComment, showChatModal, propertiesLoaded, blogsLoaded]);

  // File upload handler
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    const validFiles = [];
    const errors = [];

    // Validate each file
    Array.from(files).forEach((file, index) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errors.push(`File ${index + 1}: Please select an image file`);
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`File ${index + 1}: File size must be less than 10MB`);
        return;
      }

      validFiles.push(file);
    });

    // Show errors if any
    if (errors.length > 0) {
      setFileUploadError(errors.join(', '));
      setTimeout(() => setFileUploadError(''), 5000);
      return;
    }

    // Limit to 10 images maximum
    if (validFiles.length > 10) {
      setFileUploadError('Maximum 10 images allowed at once');
      setTimeout(() => setFileUploadError(''), 3000);
      return;
    }

    // Show preview with caption input instead of directly sending
    setSelectedFiles(validFiles);
    setPreviewIndex(0); // Reset to first image
    setShowImagePreviewModal(true);
    setFileUploadError('');
  };

  const sendImageMessage = async (imageUrl, fileName, caption = '') => {
    // Create a temporary message object with immediate display
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      senderName: currentUser.username,
      message: caption || '',
      imageUrl: imageUrl,
      status: "sending",
      timestamp: new Date().toISOString(),
      readBy: [currentUser._id],
      type: "image"
    };

    // Immediately update UI
    setLocalComments(prev => [...prev, tempMessage]);

    // Scroll to bottom
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Send message in background
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          imageUrl: imageUrl,
          type: "image"
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      // Find the new comment from the response
      const newCommentFromServer = data.comments[data.comments.length - 1];

      // Update only the status and ID of the temp message, keeping it visible
      setLocalComments(prev => prev.map(msg =>
        msg._id === tempId
          ? {
            ...msg,
            _id: newCommentFromServer._id,
            status: newCommentFromServer.status,
            readBy: newCommentFromServer.readBy || msg.readBy,
            timestamp: newCommentFromServer.timestamp || msg.timestamp
          }
          : msg
      ));
    } catch (error) {
      console.error('Send image error:', error);
      setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
      toast.error(error.response?.data?.message || "Failed to send image.");
    }
  };

  // Chat image download function (similar to ImagePreview logic)
  const handleDownloadChatImage = async (imageUrl, messageId) => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      toast.error('Error: Invalid image URL. Cannot download image.');
      return;
    }

    try {
      // Extract filename from URL or generate one
      const urlParts = imageUrl.split('/');
      const originalFilename = urlParts[urlParts.length - 1];
      let filename = originalFilename;

      // If filename doesn't have an extension or is just a hash, generate a proper name
      if (!filename.includes('.') || filename.length < 5) {
        // Try to determine file extension from URL or default to jpg
        const extension = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)?.[1] || 'jpg';
        filename = `chat-image-${messageId || Date.now()}.${extension}`;
      }

      // Try to fetch the image to handle CORS and get proper blob
      try {
        const response = await authenticatedFetch(imageUrl, {
          mode: 'cors',
          cache: 'no-cache'
        });

        if (response.ok) {
          try {
            const blob = await response.blob();

            // Validate blob
            if (!blob || blob.size === 0) {
              throw new Error('Downloaded image is empty or corrupted');
            }

            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up blob URL
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);

            // Show success feedback
            toast.success(`Image "${filename}" downloaded successfully!`);
            return; // Exit early on success

          } catch (blobError) {
            console.error('Blob processing error:', blobError);
            throw new Error(`Failed to process image data: ${blobError.message}`);
          }
        } else {
          // Handle specific HTTP error codes
          let errorMessage = `Server error (${response.status}): `;
          switch (response.status) {
            case 404:
              errorMessage += 'Image not found on server';
              break;
            case 403:
              errorMessage += 'Access denied to image';
              break;
            case 500:
              errorMessage += 'Server internal error';
              break;
            default:
              errorMessage += 'Unable to fetch image';
          }
          throw new Error(errorMessage);
        }
      } catch (fetchError) {
        console.warn('Fetch failed, trying direct download:', fetchError);

        // Show specific error for fetch failure
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          toast.warn('Network error: Trying alternative download method...');
        } else if (fetchError.message.includes('CORS')) {
          toast.warn('CORS error: Trying alternative download method...');
        } else {
          toast.warn(`Fetch error: ${fetchError.message}. Trying alternative download method...`);
        }

        // Fallback to direct link download for CORS issues
        try {
          const link = document.createElement('a');
          link.href = imageUrl;
          link.download = filename;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Show info message for direct download attempt
          toast.info('Alternative download initiated. If it doesn\'t start automatically, please try right-clicking the image and selecting "Save image as..."');
          return; // Exit early on fallback attempt

        } catch (directDownloadError) {
          console.error('Direct download failed:', directDownloadError);
          throw new Error(`Direct download failed: ${directDownloadError.message}`);
        }
      }
    } catch (error) {
      console.error('Download process failed:', error);

      // Show error notification for the main download process failure
      toast.error(`Download failed: ${error.message}. Attempting to open image in new tab...`);

      // Final fallback - open image in new tab
      try {
        const newWindow = window.open(imageUrl, '_blank', 'noopener,noreferrer');

        if (newWindow) {
          toast.info('Image opened in new tab. You can right-click to save it manually.');
        } else {
          // Pop-up blocked
          throw new Error('Pop-up blocked by browser');
        }
      } catch (openError) {
        console.error('Failed to open image in new tab:', openError);

        // Final error - all methods failed
        if (openError.message.includes('Pop-up blocked')) {
          toast.error('Error: Pop-up blocked. Please allow pop-ups for this site or right-click the image and select "Save image as..."');
        } else {
          toast.error(`All download methods failed: ${openError.message}. Please right-click the image and select "Save image as..." or check your internet connection.`);
        }
      }
    }
  };

  const handleImageFiles = (files) => {
    // Check if adding these files would exceed the 10 image limit
    const totalFiles = (selectedFiles?.length || 0) + files.length;
    if (totalFiles > 10) {
      toast.error('Maximum 10 images allowed. Please remove some images first.');
      return;
    }

    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('No valid image files found');
      return;
    }

    // Add new files to existing selection
    setSelectedFiles(prev => [...(prev || []), ...imageFiles]);

    // Initialize captions for new files
    const newCaptions = {};
    imageFiles.forEach(file => {
      newCaptions[file.name] = '';
    });
    setImageCaptions(prev => ({ ...prev, ...newCaptions }));

    // Show image preview modal
    setShowImagePreviewModal(true);

    toast.success(`${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} added successfully!`);
  };

  const handleSendImagesWithCaptions = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploadingFile(true);
    setUploadProgress(0);
    setCurrentFileIndex(-1);
    setCurrentFileProgress(0);
    setFailedFiles([]);
    setIsCancellingUpload(false);

    try {
      // Upload images sequentially so we can show progress
      let cancelledByUser = false;
      const failedLocal = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentFileIndex(i);
        setCurrentFileProgress(0);

        const uploadFormData = new FormData();
        uploadFormData.append('image', file);

        const controller = new AbortController();
        currentUploadControllerRef.current = controller;

        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/image`, {
            method: 'POST',
            body: uploadFormData,
            signal: controller.signal
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw { response: { status: res.status, data: errorData } };
          }
          const data = await res.json();

          await sendImageMessage(data.imageUrl, file.name, imageCaptions[file.name] || '');
          setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
        } catch (err) {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
            cancelledByUser = true;
            setIsCancellingUpload(true);
            break;
          } else {
            failedLocal.push(file);
          }
        } finally {
          if (currentUploadControllerRef.current === controller) {
            currentUploadControllerRef.current = null;
          }
        }
      }

      if (failedLocal.length) setFailedFiles(failedLocal);

      // Clear state only if fully successful and not cancelled
      if (!cancelledByUser && failedLocal.length === 0) {
        setSelectedFiles([]);
        setImageCaptions({});
        setPreviewIndex(0);
        setShowImagePreviewModal(false);
      }
    } catch (error) {
      console.error('File upload error:', error);
      setFileUploadError(error.response?.data?.message || 'Upload failed. Please try again.');
      toast.error(error.response?.data?.message || 'Upload failed. Please try again.');
      // Auto-hide error message after 3 seconds
      setTimeout(() => setFileUploadError(''), 3000);
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
      setCurrentFileIndex(-1);
      setCurrentFileProgress(0);
    }
  };

  // Cancel in-flight upload
  const handleCancelInFlightUpload = () => {
    if (currentUploadControllerRef.current) {
      try { currentUploadControllerRef.current.abort(); } catch (_) { }
    }
    // Do not close preview; ensure send button remains available
    setUploadingFile(false);
    setCurrentFileIndex(-1);
    setCurrentFileProgress(0);
  };

  // Retry failed uploads
  const handleRetryFailedUploads = async () => {
    if (!failedFiles.length) return;
    setSelectedFiles(failedFiles);
    setFailedFiles([]);
    await handleSendImagesWithCaptions();
  };

  // Video upload + send
  const sendVideoMessage = async (videoUrl, fileName, caption = '') => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      message: caption || '',
      videoUrl,
      type: 'video',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };
    setLocalComments(prev => [...prev, tempMessage]);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          videoUrl,
          type: 'video'
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      // Merge server comments with local temp messages to prevent loss of temporary messages
      setLocalComments(prev => {
        const serverComments = data.comments || data.updated?.comments || data?.appointment?.comments || [];
        const serverCommentIds = new Set(serverComments.map(c => c._id));
        const localTempMessages = prev.filter(c => c._id.startsWith('temp-'));

        // Combine server comments with local temp messages
        const mergedComments = [...serverComments];

        // Add back any local temp messages that haven't been confirmed yet
        localTempMessages.forEach(tempMsg => {
          if (!serverCommentIds.has(tempMsg._id)) {
            mergedComments.push(tempMsg);
          }
        });

        return mergedComments;
      });

      // CRITICAL: Update parent appointments array to keep sync working
      updateAppointmentComments(appt._id, data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      toast.error('Failed to send video');
      setLocalComments(prev => prev.filter(m => m._id !== tempId));
    }
  };

  const handleSendSelectedVideo = async () => {
    if (!selectedVideo) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('video', selectedVideo);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      await sendVideoMessage(data.videoUrl, selectedVideo.name, videoCaption);
      setSelectedVideo(null);
      setShowVideoPreviewModal(false);
      setVideoCaption('');
      setUploadProgress(0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Video upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  // Document upload + send
  const sendDocumentMessage = async (documentUrl, document, caption = '') => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      message: caption || '',
      documentUrl,
      documentName: document.name,
      documentType: document.type,
      type: 'document',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };
    setLocalComments(prev => [...prev, tempMessage]);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          documentUrl,
          documentName: document.name,
          documentType: document.type,
          type: 'document'
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      // Merge server comments with local temp messages to prevent loss of temporary messages
      setLocalComments(prev => {
        const serverComments = data.comments || data.updated?.comments || data?.appointment?.comments || [];
        const serverCommentIds = new Set(serverComments.map(c => c._id));
        const localTempMessages = prev.filter(c => c._id.startsWith('temp-'));

        // Combine server comments with local temp messages
        const mergedComments = [...serverComments];

        // Add back any local temp messages that haven't been confirmed yet
        localTempMessages.forEach(tempMsg => {
          if (!serverCommentIds.has(tempMsg._id)) {
            mergedComments.push(tempMsg);
          }
        });

        return mergedComments;
      });

      // CRITICAL: Update parent appointments array to keep sync working
      updateAppointmentComments(appt._id, data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      toast.error('Failed to send document');
      setLocalComments(prev => prev.filter(m => m._id !== tempId));
    }
  };

  // Audio upload + send
  const sendAudioMessage = async (audioUrl, file, caption = '') => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      message: caption || '',
      audioUrl,
      audioName: file.name,
      audioMimeType: file.type || null,
      type: 'audio',
      status: 'sending',
      timestamp: new Date().toISOString(),
    };
    setLocalComments(prev => [...prev, tempMessage]);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          message: caption || '',
          audioUrl,
          audioName: file.name,
          audioMimeType: file.type || null,
          type: 'audio'
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      // Merge server comments with local temp messages to prevent loss of temporary messages
      setLocalComments(prev => {
        const serverComments = data.comments || data.updated?.comments || data?.appointment?.comments || [];
        const serverCommentIds = new Set(serverComments.map(c => c._id));
        const localTempMessages = prev.filter(c => c._id.startsWith('temp-'));

        // Combine server comments with local temp messages
        const mergedComments = [...serverComments];

        // Add back any local temp messages that haven't been confirmed yet
        localTempMessages.forEach(tempMsg => {
          if (!serverCommentIds.has(tempMsg._id)) {
            mergedComments.push(tempMsg);
          }
        });

        return mergedComments;
      });

      // CRITICAL: Update parent appointments array to keep sync working
      updateAppointmentComments(appt._id, data.comments || data.updated?.comments || data?.appointment?.comments || []);
    } catch (err) {
      toast.error('Failed to send audio');
      setLocalComments(prev => prev.filter(m => m._id !== tempId));
    }
  };

  const handleSendSelectedAudio = async () => {
    if (!selectedAudio) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('audio', selectedAudio);

      // Create abort controller for cancellation
      const controller = new AbortController();
      currentUploadControllerRef.current = controller;

      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/audio`, {
        method: 'POST',
        body: form,
        signal: controller.signal
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      await sendAudioMessage(data.audioUrl, selectedAudio, audioCaption);
      setSelectedAudio(null);
      setShowAudioPreviewModal(false);
      setAudioCaption('');
      setUploadProgress(0);
    } catch (e) {
      if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') {
        // Upload cancelled by user
        return;
      }
      toast.error(e.response?.data?.message || 'Audio upload failed');
    } finally {
      setUploadingFile(false);
      currentUploadControllerRef.current = null;
    }
  };

  const handleSendSelectedDocument = async () => {
    if (!selectedDocument) return;
    try {
      setUploadingFile(true);
      const form = new FormData();
      form.append('document', selectedDocument);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/document`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      await sendDocumentMessage(data.documentUrl, selectedDocument, documentCaption);
      setSelectedDocument(null);
      setShowDocumentPreviewModal(false);
      setDocumentCaption('');
      setUploadProgress(0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Document upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleCommentSend = async () => {
    if (!newComment.trim()) return;
    // Close emoji picker on send
    window.dispatchEvent(new Event('closeEmojiPicker'));

    // Trigger send icon animation
    setSendIconAnimating(true);

    // Store the message content and reply before clearing the input
    const messageContent = newComment.trim();
    const replyToData = replyTo;

    // Store original replyTo for display purposes (even if it's a call)
    const originalReplyToId = replyToData ? replyToData._id : null;

    // Create a temporary message object with immediate display
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      sender: currentUser._id,
      senderEmail: currentUser.email,
      senderName: currentUser.username,
      message: messageContent,
      status: "sending",
      timestamp: new Date().toISOString(),
      readBy: [currentUser._id],
      previewDismissed: previewDismissed,
      // Always store the original replyTo ID for display (even if it's a call)
      ...(originalReplyToId ? { replyTo: originalReplyToId } : {}),
    };

    // Immediately update UI - this makes the message appear instantly
    setLocalComments(prev => [...prev, tempMessage]);
    try {
      if (settings.soundEnabled) playMessageSent();
    } catch (_) { }
    setNewComment("");
    try {
      const draftKey = `admin_appt_draft_${appt._id}_${currentUser._id}`;
      localStorage.removeItem(draftKey);
      // Clear backend draft
      authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ draft: "" })
      }).catch(err => console.error('Failed to clear admin backend draft:', err));
    } catch (_) { }
    setDetectedUrl(null);
    setPreviewDismissed(false);
    setLastDismissedUrl(null);
    setReplyTo(null);
    // Reset textarea height to normal after sending
    resetTextareaHeight();
    // Remove the global sending state to allow multiple messages
    // setSending(true);

    // Removed auto-focus: Don't automatically focus input after sending message
    // User can manually click to focus when needed

    // Scroll to bottom immediately after adding the message
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Send message in background without blocking UI
    (async () => {
      try {
        // Check if replyTo is a call (starts with "call-") - if so, don't send replyTo as backend can't validate call IDs
        const replyToId = replyToData && !replyToData._id?.startsWith('call-') ? replyToData._id : null;

        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment`, {
          method: 'POST',
          body: JSON.stringify({
            message: messageContent,
            ...(replyToId ? { replyTo: replyToId } : {}),
            ...(previewDismissed ? { previewDismissed: true } : {})
          })
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw { response: { status: res.status, data: errorData } };
        }
        const data = await res.json();

        // Find the new comment from the response
        const newCommentFromServer = data.comments[data.comments.length - 1];

        // Update only the status and ID of the temp message, keeping it visible
        // Preserve replyTo if it was a call (not sent to backend but stored locally)
        setLocalComments(prev => prev.map(msg =>
          msg._id === tempId
            ? {
              ...msg,
              _id: newCommentFromServer._id,
              status: newCommentFromServer.status,
              readBy: newCommentFromServer.readBy || msg.readBy,
              timestamp: newCommentFromServer.timestamp || msg.timestamp,
              // Preserve original replyTo if it was a call (backend won't return it)
              replyTo: originalReplyToId || newCommentFromServer.replyTo || msg.replyTo
            }
            : msg
        ));

        // CRITICAL: Update parent appointments array to keep sync working
        updateAppointmentComments(appt._id, data.comments);

        // Don't show success toast as it's too verbose for chat
      } catch (err) {
        // Remove the temp message and show error
        setLocalComments(prev => prev.filter(msg => msg._id !== tempId));
        setNewComment(messageContent); // Restore message
        toast.error(err.response?.data?.message || "Failed to send message.");
        // Refocus input on error - aggressive mobile focus
        // Removed auto-focus: Don't automatically focus input on error
        // User can manually click to focus when needed
      }
    })();
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;

    setSavingComment(commentId);

    // Optimistic update - update UI immediately
    const optimisticUpdate = prev => {
      const updated = prev.map(c =>
        c._id === commentId
          ? { ...c, message: editText, edited: true, editedAt: new Date() }
          : c
      );

      // Update parent component state immediately
      updateAppointmentComments(appt._id, updated);

      return updated;
    };
    setLocalComments(optimisticUpdate);

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ message: editText })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      // Update with server response
      setLocalComments(prev => {
        const updated = prev.map(c => {
          const serverComment = data.comments.find(sc => sc._id === c._id);
          if (serverComment) {
            // For the edited message, preserve edited state and use server data
            if (serverComment._id === commentId) {
              return {
                ...serverComment,
                edited: true,
                editedAt: serverComment.editedAt || new Date()
              };
            }
            // For other messages, preserve local read status if it exists
            return c.status === 'read' && serverComment.status !== 'read'
              ? { ...serverComment, status: 'read' }
              : serverComment;
          }
          return c;
        });

        // Update parent component state with the updated comments
        updateAppointmentComments(appt._id, updated);

        return updated;
      });
      setEditingComment(null);
      setEditText("");
      // Restore original draft and clear it after a small delay to ensure state update
      const draftToRestore = originalDraft;
      setNewComment(draftToRestore);
      setTimeout(() => {
        setOriginalDraft(""); // Clear stored draft after restoration
      }, 100);
      setDetectedUrl(null);
      setPreviewDismissed(false);
      setLastDismissedUrl(null);
      // Auto-resize textarea for restored draft
      setTimeout(() => {
        if (inputRef.current) {
          // Force a re-render by triggering the input event
          const event = new Event('input', { bubbles: true });
          inputRef.current.dispatchEvent(event);
          autoResizeTextarea(inputRef.current);
        }
      }, 50);

      // Removed auto-focus: Don't automatically focus input after editing
      // User can manually click to focus when needed

      toast.success("Message edited successfully!");
    } catch (err) {
      console.error('Error editing comment:', err);
      // Revert optimistic update on error
      setLocalComments(prev => {
        const reverted = prev.map(c =>
          c._id === commentId
            ? { ...c, message: c.originalMessage || c.message, edited: c.wasEdited || false }
            : c
        );

        // Update parent component state with reverted changes
        updateAppointmentComments(appt._id, reverted);

        return reverted;
      });
      setEditingComment(commentId);
      setEditText(editText);
      setNewComment(editText); // Restore the text in main input for retry
      toast.error("An error occurred. Please try again.");
    } finally {
      setSavingComment(null);
    }
  };

  // Utility function to auto-resize textarea with scrolling support
  const autoResizeTextarea = (textarea) => {
    if (textarea) {
      textarea.style.height = '48px';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 144;

      if (scrollHeight <= maxHeight) {
        // If content fits within max height, expand the textarea
        textarea.style.height = scrollHeight + 'px';
        textarea.style.overflowY = 'hidden';
      } else {
        // If content exceeds max height, set to max height and enable scrolling
        textarea.style.height = maxHeight + 'px';
        textarea.style.overflowY = 'auto';
      }
    }
  };

  // Function to reset textarea to normal height
  const resetTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
      inputRef.current.style.overflowY = 'hidden';
    }
  };

  const startEditing = (comment) => {
    // Store the current draft before starting edit
    setOriginalDraft(newComment);
    setEditingComment(comment._id);
    setEditText(comment.message);
    setNewComment(comment.message); // Set the message in the main input
    // Store original data for potential rollback
    setLocalComments(prev => prev.map(c =>
      c._id === comment._id
        ? { ...c, originalMessage: c.message, wasEdited: c.edited }
        : c
    ));
    // Focus the main input without selecting text
    setTimeout(() => {
      if (inputRef.current) {
        // Removed auto-focus: Don't automatically focus input
        // Place cursor at end of text instead of selecting all
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);

        // Auto-resize textarea for edited content
        autoResizeTextarea(inputRef.current);
      }
    }, 100);
  };

  const startReply = (comment) => {
    setReplyTo(comment);
    // Removed auto-focus: Don't automatically focus input
    // User can manually click to focus when needed
  };

  const showMessageInfo = (message) => {
    setSelectedMessageForInfo(message);
    setShowMessageInfoModal(true);
  };

  // Removed pin/unpin handler

  // Check if comment is from current admin user
  const isAdminComment = (comment) => {
    return comment.senderEmail === currentUser?.email;
  };

  // Add function to check if appointment is upcoming
  const isUpcoming = new Date(appt.date) > new Date() || (new Date(appt.date).toDateString() === new Date().toDateString() && (!appt.time || appt.time > new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));

  // Chat availability: for admin context, allow sending for all appointments except certain statuses
  const isChatSendBlocked = appt.status === 'rejected' || appt.status === 'cancelledByAdmin' || appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'deletedByAdmin';


  // Function to highlight searched text within message content
  const highlightSearchedText = (text, searchQuery) => {
    if (!searchQuery || !text) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return `<span class="search-text-highlight">${part}</span>`;
      }
      return part;
    }).join('');
  };

  // Search functionality
  const performSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      // Clear any existing search highlights
      document.querySelectorAll('.search-highlight').forEach(el => {
        el.classList.remove('search-highlight', 'search-pulse', 'search-glow');
      });
      // Clear any existing text highlights
      document.querySelectorAll('.search-text-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
      });
      return;
    }

    const results = localComments
      .filter(comment => !comment.deleted)
      .filter(comment =>
        comment.message.toLowerCase().includes(query.toLowerCase()) ||
        comment.senderName?.toLowerCase().includes(query.toLowerCase()) ||
        comment.senderEmail?.toLowerCase().includes(query.toLowerCase())
      )
      .map(comment => ({
        ...comment,
        matchIndex: comment.message.toLowerCase().indexOf(query.toLowerCase())
      }));

    setSearchResults(results);

    // Auto-scroll to first result if results found
    if (results.length > 0) {
      setCurrentSearchIndex(0);
      // Small delay to ensure state is updated before scrolling
      setTimeout(() => {
        scrollToSearchResult(results[0]._id);
      }, 100);
    } else {
      setCurrentSearchIndex(-1);
    }
  };

  const handleSearchInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    performSearch(query);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        // Navigate to next result
        setCurrentSearchIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'Escape') {
      setShowSearchBox(false);
      setSearchQuery("");
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      // Clear any existing text highlights
      document.querySelectorAll('.search-text-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
      });
    }
  };

  const scrollToSearchResult = (commentId) => {
    const messageElement = messageRefs.current[commentId];
    if (messageElement) {
      // Enhanced scroll animation with better timing
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });

      // Enhanced search highlight animation with multiple effects
      setTimeout(() => {
        // Remove any existing highlights first
        document.querySelectorAll('.search-highlight').forEach(el => {
          el.classList.remove('search-highlight', 'search-pulse', 'search-glow');
        });

        // Add enhanced search highlight with multiple animation classes
        messageElement.classList.add('search-highlight', 'search-pulse', 'search-glow');

        // Add a search ripple effect
        const ripple = document.createElement('div');
        ripple.className = 'search-ripple';
        messageElement.style.position = 'relative';
        messageElement.appendChild(ripple);

        // Remove ripple after animation
        setTimeout(() => {
          if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
          }
        }, 1000);

        // Remove highlight effects after enhanced duration
        setTimeout(() => {
          messageElement.classList.remove('search-highlight', 'search-pulse', 'search-glow');
        }, 3000);
      }, 300);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);

    // Find the first message from the selected date
    const targetDate = new Date(date);
    const targetDateString = targetDate.toDateString();

    const firstMessageOfDate = localComments.find(comment => {
      const commentDate = new Date(comment.timestamp);
      return commentDate.toDateString() === targetDateString;
    });

    if (firstMessageOfDate) {
      // Enhanced animation for scrolling to the message
      const messageElement = messageRefs.current[firstMessageOfDate._id];
      if (messageElement) {
        // Add a pre-animation class for better visual feedback
        messageElement.classList.add('date-jump-preparing');

        // Smooth scroll with enhanced timing
        messageElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });

        // Enhanced highlight animation with multiple effects
        setTimeout(() => {
          messageElement.classList.remove('date-jump-preparing');
          setHighlightedDateMessage(firstMessageOfDate._id);
          messageElement.classList.add('date-highlight', 'date-jump-pulse');

          // Add a ripple effect
          const ripple = document.createElement('div');
          ripple.className = 'date-jump-ripple';
          messageElement.style.position = 'relative';
          messageElement.appendChild(ripple);

          // Remove ripple after animation
          setTimeout(() => {
            if (ripple.parentNode) {
              ripple.parentNode.removeChild(ripple);
            }
          }, 1000);

          // Remove highlight effects after enhanced duration
          setTimeout(() => {
            messageElement.classList.remove('date-highlight', 'date-jump-pulse');
            setHighlightedDateMessage(null);
          }, 4000);
        }, 500);
      }
    } else {
      toast.info('No messages found for the selected date', {
        position: 'top-center',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "accepted": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "rejected": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "cancelledByBuyer": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "cancelledBySeller": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "cancelledByAdmin": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "deletedByAdmin": return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Password check before opening chat
  const handleChatButtonClick = () => {
    setShowPasswordModal(true);
    setAdminPassword("");
    setPasswordError("");
    // Reset attempts when opening modal
    localStorage.removeItem('adminAppointmentsPwAttempts');
  };

  // Load initial comments when chat modal opens (without refresh toast)
  const loadInitialComments = async () => {
    try {
      setLoadingComments(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch booking details: ${res.status}`);
      }
      const data = await res.json();
      if (data.comments) {
        // Preserve starred status and temp messages from current state
        // Preserve starred status from current state
        const updatedComments = data.comments.map(newComment => {
          const existingComment = localComments.find(c => c._id === newComment._id);
          if (existingComment && existingComment.starredBy) {
            return { ...newComment, starredBy: existingComment.starredBy };
          }
          return newComment;
        });

        // Add back any local temp messages that haven't been confirmed yet
        const localTempMessages = localComments.filter(c => c._id.startsWith('temp-'));
        const serverCommentIds = new Set(data.comments.map(c => c._id));

        localTempMessages.forEach(tempMsg => {
          if (!serverCommentIds.has(tempMsg._id)) {
            updatedComments.push(tempMsg);
          }
        });

        setLocalComments(updatedComments);

        // Auto-scroll to bottom when chat first opens (after password)
        setTimeout(() => {
          if (chatContainerRef.current && chatEndRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            chatEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
          }
        }, 100);

        // No toast notification for initial load
      }
    } catch (err) {
      console.error('Error loading initial comments:', err);
      toast.error('Failed to load messages');
    } finally {
      setLoadingComments(false);
    }
  };

  // Fetch latest comments when refresh button is clicked (with refresh toast)
  const fetchLatestComments = async () => {
    try {
      setLoadingComments(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch booking details: ${res.status}`);
      }
      const data = await res.json();
      if (data.comments) {
        // Preserve starred status and temp messages from current state
        // Preserve starred status from current state
        const updatedComments = data.comments.map(newComment => {
          const existingComment = localComments.find(c => c._id === newComment._id);
          if (existingComment && existingComment.starredBy) {
            return { ...newComment, starredBy: existingComment.starredBy };
          }
          return newComment;
        });

        // Add back any local temp messages that haven't been confirmed yet
        const localTempMessages = localComments.filter(c => c._id.startsWith('temp-'));
        const serverCommentIds = new Set(data.comments.map(c => c._id));

        localTempMessages.forEach(tempMsg => {
          if (!serverCommentIds.has(tempMsg._id)) {
            updatedComments.push(tempMsg);
          }
        });

        setLocalComments(updatedComments);

        // Don't auto-scroll to bottom - retain current scroll position

        // Show success toast notification
        toast.success('Messages refreshed successfully!', {
          autoClose: 2000,
          position: 'top-center'
        });
      }
    } catch (err) {
      console.error('Error fetching latest comments:', err);
      toast.error('Failed to refresh messages');
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError("");
    try {
      // Call backend to verify admin password
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/verify-password`, {
        method: 'POST',
        body: JSON.stringify({ password: adminPassword })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();
      if (data.success) {
        // Reset attempts on successful password
        localStorage.removeItem('adminAppointmentsPwAttempts');
        setShowPasswordModal(false);
        setAdminPassword("");
        setPasswordError("");
        setShowChatModal(true);
        // Update URL when opening chatbox
        navigate(`/admin/appointments/chat/${appt._id}?chatopen=true`, { replace: false });
        // Dispatch event to notify App.jsx that chat is opened
        window.dispatchEvent(new CustomEvent('chatOpened', {
          detail: { appointmentId: appt._id }
        }));
        // Notify parent that chat has been opened (clear URL-triggered flag)
        if (onChatOpened) {
          onChatOpened();
        }
        // Clear the shouldOpenChatFromNotification flag to prevent re-triggering
        // This ensures password modal doesn't re-open after successful verification
        if (shouldOpenChatFromNotification && activeChatAppointmentId === appt._id) {
          // Note: We can't directly set these here as they're parent state
          // The onChatOpened callback should handle clearing them in the parent
        }
        // Load initial comments when chat opens (without refresh toast)
        setTimeout(() => {
          loadInitialComments();
        }, 100);
      }
    } catch (err) {
      // Track wrong attempts locally (allow up to 3 attempts before logout)
      const key = 'adminAppointmentsPwAttempts';
      const prev = parseInt(localStorage.getItem(key) || '0');
      const next = prev + 1;
      localStorage.setItem(key, String(next));

      if (next >= 3) {
        // Sign out and redirect on third wrong attempt
        localStorage.removeItem(key);
        setShowPasswordModal(false);
        setAdminPassword("");
        setPasswordError("");
        setPasswordLoading(false);
        toast.error("Too many incorrect attempts. You've been signed out for security.");
        await signout({
          showToast: false,
          navigateTo: "/sign-in",
          delay: 100
        });
        return;
      } else {
        // Keep modal open and show remaining attempts
        const remaining = 3 - next;
        setPasswordError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before logout.`);
        toast.error(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`);
        setAdminPassword("");
      }
    }
    setPasswordLoading(false);
  };

  // Handle delete confirmation
  const handleDeleteClick = (message) => {
    setMessageToDelete(message);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return;

    try {
      setDeleteMessageLoading(true);
      // Handle call deletion (calls are stored in DB, we just remove from local display)
      if (messageToDelete.isCall || (messageToDelete._id && messageToDelete._id.startsWith('call-'))) {
        const callToDelete = messageToDelete.call || messageToDelete;
        setCallHistory(prev => prev.filter(call =>
          (call._id || call.callId) !== (callToDelete._id || callToDelete.callId)
        ));
        toast.success('Call removed from chat');
        return;
      }

      // Admin deletion is always for everyone
      if (Array.isArray(messageToDelete)) {
        const ids = messageToDelete.map(m => m._id);
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments/bulk-delete`, {
          method: 'DELETE',
          body: JSON.stringify({ commentIds: ids })
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw { response: { status: res.status, data: errorData } };
        }
        const data = await res.json();
        if (data?.comments) {
          // Merge server comments with local temp messages to prevent loss of temporary messages
          setLocalComments(prev => {
            const serverComments = data.comments;
            const serverCommentIds = new Set(serverComments.map(c => c._id));
            const localTempMessages = prev.filter(c => c._id.startsWith('temp-'));

            // Combine server comments with local temp messages
            const mergedComments = [...serverComments];

            // Add back any local temp messages that haven't been confirmed yet
            localTempMessages.forEach(tempMsg => {
              if (!serverCommentIds.has(tempMsg._id)) {
                mergedComments.push(tempMsg);
              }
            });

            return mergedComments;
          });

          // CRITICAL: Update parent appointments array to keep sync working
          updateAppointmentComments(appt._id, data.comments);
        }
        toast.success(`Deleted ${ids.length} messages for everyone!`);
      } else {
        const wasUnread = !messageToDelete.readBy?.includes(currentUser._id) &&
          messageToDelete.senderEmail !== currentUser.email;
        const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${messageToDelete._id}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw { response: { status: res.status, data: errorData } };
        }
        const data = await res.json();
        // Merge server comments with local temp messages to prevent loss of temporary messages
        setLocalComments(prev => {
          const serverComments = data.comments;
          const serverCommentIds = new Set(serverComments.map(c => c._id));
          const localTempMessages = prev.filter(c => c._id.startsWith('temp-'));

          // Combine server comments with local temp messages
          const mergedComments = [...serverComments];

          // Add back any local temp messages that haven't been confirmed yet
          localTempMessages.forEach(tempMsg => {
            if (!serverCommentIds.has(tempMsg._id)) {
              mergedComments.push(tempMsg);
            }
          });

          return mergedComments;
        });

        // CRITICAL: Update parent appointments array to keep sync working
        updateAppointmentComments(appt._id, data.comments);

        if (wasUnread) {
          setUnreadNewMessages(prev => Math.max(0, prev - 1));
        }
        toast.success("Message deleted successfully!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete message.');
    } finally {
      setDeleteMessageLoading(false);
      setShowDeleteModal(false);
      setMessageToDelete(null);
    }
  };

  const handleDeleteChat = async () => {
    if (!deleteChatPassword.trim()) return;

    try {
      setDeleteChatLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comments`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deleteChatPassword })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errorData } };
      }
      const data = await res.json();

      setLocalComments([]);
      updateAppointmentComments(appt._id, []);
      toast.success('Chat deleted successfully.');
      setShowDeleteChatModal(false);
      setDeleteChatPassword('');
    } catch (e) {
      console.error("Delete chat error:", e);
      toast.error(e.response?.data?.message || 'Failed to delete chat');
    } finally {
      setDeleteChatLoading(false);
    }
  };

  // Store locally hidden deleted message IDs per appointment
  function getLocallyHiddenIds(apptId) {
    try {
      return JSON.parse(localStorage.getItem(`hiddenDeletedMsgs_${apptId}`)) || [];
    } catch {
      return [];
    }
  }

  // Optimized functions that update both state and localStorage instantly
  const hideMessage = React.useCallback((msgId) => {
    setHiddenMessageIds(prev => {
      if (!prev.includes(msgId)) {
        const updated = [...prev, msgId];
        // Update localStorage asynchronously to avoid blocking UI
        setTimeout(() => {
          localStorage.setItem(`hiddenDeletedMsgs_${appt._id}`, JSON.stringify(updated));
        }, 0);
        return updated;
      }
      return prev;
    });
  }, [appt._id]);

  const showMessage = React.useCallback((msgId) => {
    setHiddenMessageIds(prev => {
      const updated = prev.filter(id => id !== msgId);
      // Update localStorage asynchronously to avoid blocking UI
      setTimeout(() => {
        localStorage.setItem(`hiddenDeletedMsgs_${appt._id}`, JSON.stringify(updated));
      }, 0);
      return updated;
    });
  }, [appt._id]);

  return (
    <tr className={`hover:bg-blue-50 dark:hover:bg-gray-700/50 transition align-top ${isArchived ? 'bg-gray-50 dark:bg-gray-800/50' : ''} ${!isUpcoming ? (isArchived ? 'bg-gray-100 dark:bg-gray-900/50' : 'bg-gray-100 dark:bg-gray-900/50') : ''}`}>
      <td className="border dark:border-gray-700 p-2 text-gray-800 dark:text-gray-200">
        <div>
          <div>{new Date(appt.date).toLocaleDateString('en-GB')}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{appt.time}</div>
          {!isUpcoming && (
            <div className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">Outdated</div>
          )}
          {isArchived && appt.archivedAt && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Archived: {new Date(appt.archivedAt).toLocaleDateString('en-GB')}
            </div>
          )}
        </div>
      </td>
      <td className="border dark:border-gray-700 p-2 text-gray-800 dark:text-gray-200">
        <div>
          {appt.listingId ? (
            <Link
              to={`/admin/listing/${appt.listingId._id}`}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
            >
              {appt.propertyName}
            </Link>
          ) : (
            <div className="font-semibold text-gray-800 dark:text-gray-200">{appt.propertyName}</div>
          )}
        </div>
      </td>
      <td className="border dark:border-gray-700 p-2 text-center">
        <AdminPaymentStatusCell appointmentId={appt._id} appointment={appt} />
      </td>
      <td className="border dark:border-gray-700 p-2 text-gray-800 dark:text-gray-200">
        <button
          onClick={() => onUserClick(appt.buyerId?._id)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
          title="Click to view buyer details"
        >
          <div className="font-semibold">{appt.buyerId?.username || 'Unknown'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <a
              href={`mailto:${appt.buyerId?.email || appt.email}`}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors duration-200"
              title="Click to send email"
              onClick={(e) => e.stopPropagation()}
            >
              {appt.buyerId?.email || appt.email}
            </a>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {appt.buyerId?.mobileNumber && appt.buyerId?.mobileNumber !== '' ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handlePhoneClick(appt.buyerId.mobileNumber);
                }}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline transition-colors duration-200 cursor-pointer"
                title="Click to call or copy phone number"
              >
                {appt.buyerId.mobileNumber}
              </span>
            ) : (
              'No phone'
            )}
          </div>
        </button>
      </td>
      <td className="border dark:border-gray-700 p-2 text-gray-800 dark:text-gray-200">
        <button
          onClick={() => onUserClick(appt.sellerId?._id)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
          title="Click to view seller details"
        >
          <div className="font-semibold">{appt.sellerId?.username || 'Unknown'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <a
              href={`mailto:${appt.sellerId?.email}`}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors duration-200"
              title="Click to send email"
              onClick={(e) => e.stopPropagation()}
            >
              {appt.sellerId?.email}
            </a>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {appt.sellerId?.mobileNumber && appt.sellerId?.mobileNumber !== '' ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handlePhoneClick(appt.sellerId.mobileNumber);
                }}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline transition-colors duration-200 cursor-pointer"
                title="Click to call or copy phone number"
              >
                {appt.sellerId.mobileNumber}
              </span>
            ) : (
              'No phone'
            )}
          </div>
        </button>
      </td>
      <td className="border dark:border-gray-700 p-2 capitalize text-gray-800 dark:text-gray-200">{appt.purpose}</td>
      <td className="border dark:border-gray-700 p-2 max-w-xs truncate text-gray-800 dark:text-gray-200">{appt.message || 'No message provided'}</td>
      <td className="border dark:border-gray-700 p-2 text-center">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(appt.status)}`}>
          {appt.status === "deletedByAdmin" ? "Deleted by Admin" :
            appt.status === "cancelledByBuyer" ? "Cancelled by Buyer" :
              appt.status === "cancelledBySeller" ? "Cancelled by Seller" :
                appt.status === "cancelledByAdmin" ? "Cancelled by Admin" :
                  appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
        </span>
        {appt.status === "deletedByAdmin" && appt.adminComment && (
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">"{appt.adminComment}"</div>
        )}
        {(appt.status === "cancelledByBuyer" || appt.status === "cancelledBySeller") && (
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {appt.status === "cancelledByBuyer"
              ? `Buyer reinitiations: ${appt.buyerReinitiationCount || 0}/2`
              : `Seller reinitiations: ${appt.sellerReinitiationCount || 0}/2`
            }
          </div>
        )}
      </td>
      <td className="border dark:border-gray-700 p-2 text-center">
        <div className="flex flex-col gap-2">
          {isArchived ? (
            // Archived appointments - show unarchive button
            <button
              className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
              onClick={() => handleUnarchiveAppointment(appt._id)}
              title="Unarchive Appointment"
            >
              <FaUndo /> Unarchive
            </button>
          ) : (
            // Active appointments - show archive button and other actions
            <>
              {appt.status === "cancelledByAdmin" ? (
                <button
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                  onClick={() => handleReinitiateAppointment(appt._id)}
                  title="Reinitiate Appointment (Admin)"
                >
                  <FaUserShield /> Reinitiate
                </button>
              ) : appt.status !== "deletedByAdmin" ? (
                <button
                  className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                  onClick={() => handleAdminCancel(appt._id)}
                  title="Cancel Appointment (Admin)"
                >
                  <FaUserShield /> Cancel
                </button>
              ) : null}

              {/* Archive button for all active appointments */}
              <button
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                onClick={() => handleArchiveAppointment(appt._id)}
                title="Archive Appointment"
              >
                <FaArchive /> Archive
              </button>
            </>
          )}
        </div>
      </td>
      <td className="border dark:border-gray-700 p-2 text-center relative">
        <button
          className="flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-3 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 mx-auto relative group"
          title="Open Chat"
          onClick={handleChatButtonClick}
        >
          <FaCommentDots size={22} className="group-hover:animate-pulse" />
          <div className="absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
        </button>
        {showPasswordModal && !showChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs relative flex flex-col items-center border dark:border-gray-700">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors"
                onClick={() => setShowPasswordModal(false)}
                title="Close"
              >
                <FaTimes className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold mb-4 text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <FaUserShield /> Admin Password Required
              </h3>
              <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-3">
                <div>
                  <input
                    ref={passwordInputRef}
                    type="password"
                    className="border dark:border-gray-600 rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    required
                  />
                  {passwordError && (
                    <div className="text-red-600 dark:text-red-400 text-sm mt-1">{passwordError}</div>
                  )}
                </div>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full font-semibold"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? "Verifying..." : "Unlock Chat"}
                </button>
              </form>
            </div>
          </div>
        )}
        {showChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950 rounded-3xl shadow-2xl w-full h-full max-w-6xl max-h-full p-0 relative animate-fadeIn flex flex-col border border-gray-200 dark:border-gray-700 transform transition-all duration-500 hover:shadow-3xl">
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-blue-700 bg-gradient-to-r from-blue-700 via-purple-700 to-blue-900 rounded-t-3xl relative shadow-2xl sticky top-[env(safe-area-inset-top,0px)] z-30">
                {isSelectionMode ? (
                  // Multi-select header
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-white text-sm cursor-pointer hover:text-blue-200 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedMessages.length === localComments.length && localComments.length > 0}
                          onChange={() => {
                            if (selectedMessages.length === localComments.length) {
                              // If all are selected, deselect all
                              setSelectedMessages([]);
                            } else {
                              // Select all non-deleted messages
                              setSelectedMessages([...localComments]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="font-medium">Select All Messages</span>
                      </label>
                      <span className="text-white text-sm font-medium">
                        ({selectedMessages.length} message{selectedMessages.length !== 1 ? 's' : ''} selected)
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {selectedMessages.length === 1 ? (
                        // Single message selected - show individual message options
                        <div className="flex items-center gap-2">
                          {(() => {
                            const selectedMsg = selectedMessages[0];
                            const isSentMessage = selectedMsg.senderEmail === currentUser.email;
                            return (
                              <>
                                {!selectedMsg.deleted && (
                                  <>
                                    <button
                                      className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={() => {
                                        startReply(selectedMsg);
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title="Reply"
                                      aria-label="Reply"
                                    >
                                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z" /></svg>
                                    </button>
                                    <button
                                      className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={() => {
                                        copyMessageToClipboard(selectedMsg.message);
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title="Copy message"
                                      aria-label="Copy message"
                                    >
                                      <FaCopy size={18} />
                                    </button>
                                    <button
                                      className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={async () => {
                                        const isStarred = selectedMsg.starredBy?.includes(currentUser._id);
                                        setMultiSelectActions(prev => ({ ...prev, starring: true }));
                                        try {
                                          const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMsg._id}/star`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({ starred: !isStarred })
                                          });
                                          if (!res.ok) {
                                            const errorData = await res.json().catch(() => ({}));
                                            throw { response: { status: res.status, data: errorData } };
                                          }
                                          const data = await res.json();
                                          setLocalComments(prev => {
                                            const updated = prev.map(c =>
                                              c._id === selectedMsg._id
                                                ? {
                                                  ...c,
                                                  starredBy: isStarred
                                                    ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                                    : [...(c.starredBy || []), currentUser._id]
                                                }
                                                : c
                                            );

                                            // Update appointment comments for parent component with the updated state
                                            updateAppointmentComments(appt._id, updated);

                                            return updated;
                                          });

                                          // Update starred messages list
                                          if (isStarred) {
                                            // Remove from starred messages
                                            setStarredMessages(prev => prev.filter(m => m._id !== selectedMsg._id));
                                          } else {
                                            // Add to starred messages
                                            setStarredMessages(prev => [...prev, selectedMsg]);
                                          }

                                          toast.success(isStarred ? 'Message unstarred.' : 'Message starred.');
                                        } catch (err) {
                                          toast.error('Failed to update star status');
                                        } finally {
                                          setMultiSelectActions(prev => ({ ...prev, starring: false }));
                                        }
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title={selectedMsg.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                                      aria-label={selectedMsg.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                                      disabled={multiSelectActions.starring}
                                    >
                                      {multiSelectActions.starring ? (
                                        <UrbanSetuSpinner size="sm" isBright={true} />
                                      ) : selectedMsg.starredBy?.includes(currentUser._id) ? (
                                        <FaStar size={18} />
                                      ) : (
                                        <FaRegStar size={18} />
                                      )}
                                    </button>
                                    <button
                                      className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                                      onClick={() => {
                                        setMessageToDelete(selectedMsg);
                                        setShowDeleteModal(true);
                                        setIsSelectionMode(false);
                                        setSelectedMessages([]);
                                      }}
                                      title="Delete"
                                      aria-label="Delete"
                                    >
                                      <FaTrash size={18} />
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : selectedMessages.length > 1 ? (
                        // Multiple messages selected - show bulk actions
                        <div className="flex items-center gap-2">
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={async () => {
                              setMultiSelectActions(prev => ({ ...prev, starring: true }));
                              try {


                                // Process messages one by one to handle individual failures gracefully
                                let successCount = 0;
                                let failureCount = 0;
                                const failedMessages = [];

                                for (const msg of selectedMessages) {
                                  try {
                                    const isStarred = msg.starredBy?.includes(currentUser._id);


                                    const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${msg._id}/star`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ starred: !isStarred })
                                    });
                                    if (!res.ok) {
                                      const errorData = await res.json().catch(() => ({}));
                                      throw { response: { status: res.status, data: errorData } };
                                    }
                                    const data = await res.json();
                                    const response = { status: 200, data };


                                    successCount++;

                                    // Update this specific message in local comments
                                    setLocalComments(prev => {
                                      const updated = prev.map(c =>
                                        c._id === msg._id
                                          ? {
                                            ...c,
                                            starredBy: isStarred
                                              ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                              : [...(c.starredBy || []), currentUser._id]
                                          }
                                          : c
                                      );

                                      // Update appointment comments for parent component with the updated state
                                      updateAppointmentComments(appt._id, updated);

                                      return updated;
                                    });

                                    // Update starred messages list for this message
                                    setStarredMessages(prev => {
                                      if (isStarred) {
                                        // Remove from starred messages
                                        return prev.filter(m => m._id !== msg._id);
                                      } else {
                                        // Add to starred messages
                                        if (!prev.some(m => m._id === msg._id)) {
                                          return [...prev, { ...msg, starredBy: [...(msg.starredBy || []), currentUser._id] }];
                                        }
                                        return prev;
                                      }
                                    });

                                  } catch (err) {
                                    console.error(`Failed to process message ${msg._id}:`, err);
                                    failureCount++;
                                    failedMessages.push(msg);
                                  }
                                }



                                // Show appropriate feedback
                                if (successCount > 0 && failureCount === 0) {
                                  toast.success(`Successfully updated star status for ${successCount} messages`);
                                } else if (successCount > 0 && failureCount > 0) {
                                  toast.warning(`Partially successful: ${successCount} messages updated, ${failureCount} failed`);
                                } else {
                                  toast.error(`Failed to update any messages. Please try again.`);
                                }

                                // Clear selection mode if all messages were processed successfully
                                if (failureCount === 0) {
                                  setIsSelectionMode(false);
                                  setSelectedMessages([]);
                                }
                              } catch (err) {
                                console.error('Error in bulk starring operation:', err);
                                if (err.response) {
                                  console.error('Response data:', err.response.data);
                                  console.error('Response status:', err.response.status);
                                }
                                toast.error(err.response?.data?.message || 'Failed to star messages. Please try again.');
                              } finally {
                                setMultiSelectActions(prev => ({ ...prev, starring: false }));
                              }
                            }}
                            title="Star all selected messages"
                            aria-label="Star all selected messages"
                            disabled={multiSelectActions.starring}
                          >
                            {multiSelectActions.starring ? (
                              <UrbanSetuSpinner size="sm" isBright={true} />
                            ) : (
                              <FaStar size={18} />
                            )}
                          </button>
                          {/* Pinning removed */}
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => {
                              const allMessages = selectedMessages.map(msg => msg.message).join('\n\n');
                              copyMessageToClipboard(allMessages);
                              toast.success('Copied all selected messages');
                              setIsSelectionMode(false);
                              setSelectedMessages([]);
                            }}
                            title="Copy all selected messages"
                            aria-label="Copy all selected messages"
                          >
                            <FaCopy size={18} />
                          </button>
                          <button
                            className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => {
                              setMessageToDelete(selectedMessages);
                              setShowDeleteModal(true);
                              setIsSelectionMode(false);
                              setSelectedMessages([]);
                            }}
                            title="Delete all selected messages"
                            aria-label="Delete all selected messages"
                          >
                            <FaTrash size={18} />
                          </button>
                        </div>
                      ) : null}
                      <button
                        className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedMessages([]);
                        }}
                        title="Exit selection mode"
                        aria-label="Exit selection mode"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : headerOptionsMessageId && selectedCallForHeaderOptions ? (
                  // Header-level options overlay for call history items (admin view: reply, info modal, delete)
                  <div className="flex items-center justify-end w-full gap-4">
                    <div className="flex items-center gap-4">
                      {/* Reply */}
                      <button
                        className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => {
                          // Create a fake message-like object for reply functionality
                          const fakeMessage = {
                            _id: `call-${selectedCallForHeaderOptions._id || selectedCallForHeaderOptions.callId}`,
                            senderEmail: selectedCallForHeaderOptions.callerId?.email || 'unknown',
                            message: `${selectedCallForHeaderOptions.callType === 'video' ? 'Video' : 'Audio'} call`,
                            timestamp: selectedCallForHeaderOptions.startTime || selectedCallForHeaderOptions.createdAt,
                            isCall: true,
                            call: selectedCallForHeaderOptions
                          };
                          startReply(fakeMessage);
                          setHeaderOptionsMessageId(null);
                        }}
                        title="Reply"
                        aria-label="Reply"
                      >
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z" /></svg>
                      </button>
                      {/* Call info modal */}
                      <button
                        className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => {
                          setSelectedCallForInfo(selectedCallForHeaderOptions);
                          setShowCallInfoModal(true);
                          setHeaderOptionsMessageId(null);
                        }}
                        title="Call info"
                        aria-label="Call info"
                      >
                        <FaInfoCircle size={18} />
                      </button>
                      {/* Delete */}
                      <button
                        className="text-white hover:text-red-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                        onClick={() => {
                          // Show confirmation modal for call deletion
                          setMessageToDelete({
                            _id: `call-${selectedCallForHeaderOptions._id || selectedCallForHeaderOptions.callId}`,
                            isCall: true,
                            call: selectedCallForHeaderOptions
                          });
                          setShowDeleteModal(true);
                          setHeaderOptionsMessageId(null);
                        }}
                        title="Delete call"
                        aria-label="Delete call"
                      >
                        <FaTrash size={18} />
                      </button>
                      {/* Close button */}
                      <button
                        className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 shadow"
                        onClick={() => { setHeaderOptionsMessageId(null); setShowHeaderMoreMenu(false); }}
                        title="Close options"
                        aria-label="Close options"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : headerOptionsMessageId && selectedMessageForHeaderOptions ? (
                  <div className="flex items-center justify-end w-full gap-4">
                    <div className="flex items-center gap-4">
                      {/* For deleted messages, only show star and close options */}
                      {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.deleted ? (
                        <>
                          {/* Star/Unstar - for deleted messages */}
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={async () => {
                              const isStarred = selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id);
                              setStarringSaving(true);
                              try {
                                const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id}/star`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ starred: !isStarred })
                                });
                                if (!res.ok) {
                                  const errorData = await res.json().catch(() => ({}));
                                  throw { response: { status: res.status, data: errorData } };
                                }
                                const data = await res.json();
                                // Update the local state
                                setLocalComments(prev => {
                                  const updated = prev.map(c =>
                                    c._id === (selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id)
                                      ? {
                                        ...c,
                                        starredBy: isStarred
                                          ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                          : [...(c.starredBy || []), currentUser._id]
                                      }
                                      : c
                                  );

                                  // Update appointment comments for parent component with the updated state
                                  updateAppointmentComments(appt._id, updated);

                                  return updated;
                                });

                                // Update starred messages list
                                if (isStarred) {
                                  // Remove from starred messages
                                  setStarredMessages(prev => prev.filter(m => m._id !== (selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id)));
                                } else {
                                  // Add to starred messages
                                  setStarredMessages(prev => [...prev, selectedMessageForHeaderOptions]);
                                }

                                toast.success(isStarred ? 'Message unstarred' : 'Message starred');
                              } catch (err) {
                                toast.error('Failed to update star status');
                              } finally {
                                setStarringSaving(false);
                              }
                              setHeaderOptionsMessageId(null);
                            }}
                            title={selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                            aria-label={selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                            disabled={starringSaving}
                          >
                            {starringSaving ? (
                              <UrbanSetuSpinner size="sm" isBright={true} />
                            ) : selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? (
                              <FaStar size={18} />
                            ) : (
                              <FaRegStar size={18} />
                            )}
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Regular message options for non-deleted messages */}
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => {
                              startReply(selectedMessageForHeaderOptions);
                              setHeaderOptionsMessageId(null);
                            }}
                            title="Reply"
                            aria-label="Reply"
                          >
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.92 1.45 8.84 4.55.23.36.76.09.65-.32C18.31 13.13 15.36 10.36 10 9z" /></svg>
                          </button>
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => { copyMessageToClipboard(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.message); setHeaderOptionsMessageId(null); }}
                            title="Copy message"
                            aria-label="Copy message"
                          >
                            <FaCopy size={18} />
                          </button>
                          {/* Star/Unstar - for regular messages */}
                          <button
                            className="text-white hover:text-yellow-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={async () => {
                              const isStarred = selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id);
                              setStarringSaving(true);
                              try {
                                const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id}/star`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ starred: !isStarred })
                                });
                                if (!res.ok) {
                                  const errorData = await res.json().catch(() => ({}));
                                  throw { response: { status: res.status, data: errorData } };
                                }
                                const data = await res.json();
                                // Update the local state
                                setLocalComments(prev => {
                                  const updated = prev.map(c =>
                                    c._id === (selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id)
                                      ? {
                                        ...c,
                                        starredBy: isStarred
                                          ? (c.starredBy || []).filter(id => id !== currentUser._id)
                                          : [...(c.starredBy || []), currentUser._id]
                                      }
                                      : c
                                  );

                                  // Update appointment comments for parent component with the updated state
                                  updateAppointmentComments(appt._id, updated);

                                  return updated;
                                });

                                // Update starred messages list
                                if (isStarred) {
                                  // Remove from starred messages
                                  setStarredMessages(prev => prev.filter(m => m._id !== (selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id)));
                                } else {
                                  // Add to starred messages
                                  setStarredMessages(prev => [...prev, selectedMessageForHeaderOptions]);
                                }

                                toast.success(isStarred ? 'Message unstarred' : 'Message starred');
                              } catch (err) {
                                toast.error('Failed to update star status');
                              } finally {
                                setStarringSaving(false);
                              }
                              setHeaderOptionsMessageId(null);
                            }}
                            title={selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                            aria-label={selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? "Unstar message" : "Star message"}
                            disabled={starringSaving}
                          >
                            {starringSaving ? (
                              <UrbanSetuSpinner size="sm" isBright={true} />
                            ) : selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.starredBy?.includes(currentUser._id) ? (
                              <FaStar size={18} />
                            ) : (
                              <FaRegStar size={18} />
                            )}
                          </button>
                        </>
                      )}
                      {/* Three-dots menu: sent -> Info, Edit, Delete; received -> Info, Delete */}
                      {selectedMessageForHeaderOptions && !selectedMessageForHeaderOptions.deleted && (
                        <div className="relative">
                          <button
                            className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            onClick={() => {
                              setShowHeaderMoreMenu(prev => !prev);
                              // Close reactions bar when header more menu toggles
                              if (!showHeaderMoreMenu) {
                                setShowReactionsBar(false);
                                setReactionsMessageId(null);
                              }
                            }}
                            title="More options"
                            aria-label="More options"
                          >
                            <FaEllipsisV size={14} />
                          </button>
                          {showHeaderMoreMenu && (
                            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 min-w-[180px] chat-options-menu">
                              {(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.senderEmail === currentUser.email) ? (
                                <>
                                  {/* Download option for image messages */}
                                  {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.imageUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center gap-2"
                                      onClick={() => {
                                        handleDownloadChatImage(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.imageUrl, selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id);
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Image
                                    </button>
                                  )}
                                  {/* Download option for video messages */}
                                  {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.videoUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.videoUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                          toast.success('Video downloaded successfully');
                                        } catch (error) {
                                          console.error('Video download failed:', error);
                                          // Fallback to direct link
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.videoUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          toast.success('Video download started');
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Video
                                    </button>
                                  )}
                                  {/* Download option for audio messages */}
                                  {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                          toast.success('Audio downloaded successfully');
                                        } catch (error) {
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          toast.success('Audio download started');
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Audio
                                    </button>
                                  )}
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    onClick={() => { showMessageInfo(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaInfoCircle className="text-sm" />
                                    Info
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    onClick={() => { startEditing(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                    disabled={editingComment !== null}
                                  >
                                    <FaPen className="text-sm" />
                                    Edit
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 flex items-center gap-2"
                                    onClick={() => { handleDeleteClick(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaTrash className="text-sm" />
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* Download option for image messages (for received messages) */}
                                  {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.imageUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center gap-2"
                                      onClick={() => {
                                        handleDownloadChatImage(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.imageUrl, selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id);
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Image
                                    </button>
                                  )}
                                  {/* Download option for video messages (for received messages) */}
                                  {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.videoUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.videoUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                          toast.success('Video downloaded successfully');
                                        } catch (error) {
                                          console.error('Video download failed:', error);
                                          // Fallback to direct link
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.videoUrl;
                                          a.download = `video-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}.mp4`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          toast.success('Video download started');
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Video
                                    </button>
                                  )}
                                  {/* Download option for audio messages (for received messages) */}
                                  {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center gap-2"
                                      onClick={async () => {
                                        try {
                                          const response = await authenticatedFetch(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl, { mode: 'cors' });
                                          if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                          const blob = await response.blob();
                                          const blobUrl = window.URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = blobUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                          toast.success('Audio downloaded successfully');
                                        } catch (error) {
                                          const a = document.createElement('a');
                                          a.href = selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl;
                                          a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}`;
                                          a.target = '_blank';
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          toast.success('Audio download started');
                                        }
                                        setShowHeaderMoreMenu(false);
                                        setHeaderOptionsMessageId(null);
                                      }}
                                    >
                                      <FaDownload className="text-sm" />
                                      Download Audio
                                    </button>
                                  )}
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    onClick={() => { showMessageInfo(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaInfoCircle className="text-sm" />
                                    Info
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 flex items-center gap-2"
                                    onClick={() => { handleDeleteClick(selectedMessageForHeaderOptions); setShowHeaderMoreMenu(false); setHeaderOptionsMessageId(null); }}
                                  >
                                    <FaTrash className="text-sm" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 shadow"
                      onClick={() => { setHeaderOptionsMessageId(null); setShowHeaderMoreMenu(false); }}
                      title="Close options"
                      aria-label="Close options"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-full p-1.5 shadow-lg">
                      <FaCommentDots className="text-blue-600 text-lg" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Live Chat</h3>

                    <div className="flex items-center gap-3 ml-auto">


                      {/* Search functionality */}
                      <div className="relative search-container">
                        <button
                          className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all duration-300 transform hover:scale-110 shadow"
                          onClick={() => {
                            setShowSearchBox(true);
                            // Close reactions bar when search box opens
                            setShowReactionsBar(false);
                            setReactionsMessageId(null);
                          }}
                          title="Search messages"
                          aria-label="Search messages"
                        >
                          <FaSearch className="text-sm" />
                        </button>
                      </div>

                      {/* Chat options menu */}
                      <div className="relative flex items-center gap-2">
                        {/* Loading icon when refreshing messages */}
                        {loadingComments && (
                          <div className="text-white bg-white/10 rounded-full p-1.5 shadow">
                            <UrbanSetuSpinner size="xs" isBright={true} />
                          </div>
                        )}

                        <button
                          className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors shadow"
                          onClick={() => {
                            setShowChatOptionsMenu(!showChatOptionsMenu);
                            // Close reactions bar when chat options menu toggles
                            if (!showChatOptionsMenu) {
                              setShowReactionsBar(false);
                              setReactionsMessageId(null);
                            }
                          }}
                          title="Chat options"
                          aria-label="Chat options"
                        >
                          <FaEllipsisV className="text-sm" />
                        </button>
                        {showChatOptionsMenu && (
                          <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 min-w-[180px] chat-options-menu">
                            {/* Reports option (appointment-scoped) */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                              onClick={() => {
                                setShowReportsModal(true);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaFlag className="text-sm" />
                              Reports
                            </button>
                            {/* Refresh option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                fetchLatestComments();
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaSync className="text-sm" />
                              Refresh Messages
                            </button>
                            {/* Settings option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                setShowSettingsModal(true);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaCog className="text-sm" />
                              Settings
                            </button>
                            {/* Starred Messages option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 flex items-center gap-2"
                              onClick={() => {
                                setShowStarredModal(true);
                                setShowChatOptionsMenu(false);
                                // Close reactions bar when starred modal opens
                                setShowReactionsBar(false);
                                setReactionsMessageId(null);
                              }}
                            >
                              <FaStar className="text-sm" />
                              Starred Messages
                            </button>

                            {/* Pinned Messages option removed */}

                            {/* Select Messages option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                              onClick={() => {
                                setIsSelectionMode(true);
                                setSelectedMessages([]);
                                setShowChatOptionsMenu(false);
                                // Close reactions bar when selection mode opens
                                setShowReactionsBar(false);
                                setReactionsMessageId(null);
                              }}
                            >
                              <FaCheckSquare className="text-sm" />
                              Select Messages
                            </button>
                            {/* Text Styling option */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 flex items-center gap-2"
                              onClick={() => {
                                setShowTextStylingPanel(!showTextStylingPanel);
                                setShowChatOptionsMenu(false);
                                // Close reactions bar when text styling panel toggles
                                setShowReactionsBar(false);
                                setReactionsMessageId(null);
                              }}
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M5 4v3h5.5v12h3V7H19V4H5z" />
                              </svg>
                              Text Styling
                            </button>
                            {/* Keyboard shortcuts and file upload guidelines */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                setShowShortcutTip(!showShortcutTip);
                                setShowChatOptionsMenu(false);
                                // Close reactions bar when shortcut tip toggles
                                setShowReactionsBar(false);
                                setReactionsMessageId(null);
                              }}
                            >
                              <FaLightbulb className="text-sm" />
                              Tips & Guidelines
                            </button>
                            {/* Export Chat option */}
                            {localComments.length > 0 && (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 flex items-center gap-2"
                                onClick={() => {
                                  setShowChatOptionsMenu(false);
                                  onExportChat(appt, localComments, callHistory);
                                }}
                              >
                                <FaDownload className="text-sm" />
                                Export Chat Transcript (PDF)
                              </button>
                            )}
                            {/* Call History option */}
                            {setShowCallHistoryModal && setCallHistoryAppointmentId && (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 flex items-center gap-2"
                                onClick={() => {
                                  setCallHistoryAppointmentId(appt._id);
                                  setShowCallHistoryModal(true);
                                  setShowChatOptionsMenu(false);
                                }}
                              >
                                <FaHistory className="text-sm" />
                                Call History
                              </button>
                            )}
                            {/* User details option for buyer */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                onUserClick(appt.buyerId?._id);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaUser className="text-sm" />
                              View Buyer Details
                            </button>
                            {/* User details option for seller */}
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                onUserClick(appt.sellerId?._id);
                                setShowChatOptionsMenu(false);
                              }}
                            >
                              <FaUser className="text-sm" />
                              View Seller Details
                            </button>
                            {/* Divider line */}
                            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                            {/* Delete chat option */}
                            {localComments.length > 0 && (
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                                onClick={() => {
                                  setShowDeleteChatModal(true);
                                  setShowChatOptionsMenu(false);
                                  // Close reactions bar when delete chat modal opens
                                  setShowReactionsBar(false);
                                  setReactionsMessageId(null);
                                }}
                              >
                                <FaTrash className="text-sm" />
                                Delete Entire Chat
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Live Call Monitor button (admin view) */}
                      <button
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-all duration-300 transform hover:scale-110 shadow text-[10px] ${activeLiveCall
                          ? 'text-red-500 hover:text-red-600 bg-red-50/80 hover:bg-red-100'
                          : 'text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200'
                          }`}
                        onClick={async () => {
                          // Always fetch the latest active call just before opening the monitor
                          let latestActive = activeLiveCall;
                          if (!latestActive || !latestActive.callId) {
                            latestActive = await fetchLatestActiveCall();
                          }

                          if (latestActive && latestActive.callId) {
                            socket.emit('admin-monitor-join', { callId: latestActive.callId });
                            setShowLiveMonitorModal(true);
                          } else {
                            toast.info('No active audio/video call found for this appointment.');
                          }
                        }}
                        title={activeLiveCall ? 'Live audio/video monitor' : 'Not live - no active call'}
                        aria-label="Live audio/video monitor"
                      >
                        <FaCircle
                          className={`text-[10px] ${activeLiveCall ? 'animate-pulse text-red-500' : 'text-gray-400'
                            }`}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide">
                          {activeLiveCall ? 'Live' : 'Not Live'}
                        </span>
                      </button>
                      <ChatSettingsModal
                        isOpen={showSettingsModal}
                        onClose={() => setShowSettingsModal(false)}
                        settings={settings}
                        updateSetting={updateSetting}
                      />
                      {showShortcutTip && (
                        <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-20 max-w-xs animate-fadeIn">
                          <div className="font-semibold mb-2">⌨️ Keyboard Shortcuts:</div>
                          <div>• Press Ctrl + / to quickly focus and type your message</div>
                          <div>• @ mention any property/blog/guide</div>
                          <div>• Press Esc to close chatbox.</div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">📎 File Upload Guidelines:</div>
                            <div>• Photos: JPG, PNG, GIF, WebP (≤ 10MB)</div>
                            <div>• Videos: MP4, WebM, MOV, MKV, OGG (≤ 100MB)</div>
                            <div>• Documents: PDF, DOCX, XLSX, TXT and more (≤ 10MB)</div>
                            <div>• Audio: MP3, WAV, M4A, OGG (≤ 10MB)</div>
                            <div>• Camera: Direct photo capture from device</div>
                            <div>• Add captions to all media types</div>
                          </div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">💬 Chat Features:</div>
                            <div>• Real-time messaging with socket.io</div>
                            <div>• Message reactions and emoji support</div>
                            <div>• File sharing and media previews</div>
                            <div>• Audio recording with pause/resume</div>
                            <div>• Audio playback with speed controls</div>
                            <div>• Message editing and deletion</div>
                            <div>• Message starring and search</div>
                            <div>• Chat export to PDF</div>
                            <div>• Chat locking for dispute resolution</div>
                          </div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">🔒 Security & Moderation:</div>
                            <div>• Report inappropriate content</div>
                            <div>• Report chat</div>
                            <div>• Content filtering and moderation</div>
                            <div>• User blocking capabilities</div>
                          </div>
                          <div className="border-t border-gray-600 pt-2 mt-2">
                            <div className="font-semibold mb-2">👨‍💼 Admin Controls:</div>
                            <div>• Full chat moderation access</div>
                            <div>• User management and blocking</div>
                            <div>• Content removal and warnings</div>
                            <div>• Dispute resolution tools</div>
                          </div>
                          <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                        </div>
                      )}
                      {/* Scroll to bottom button when there are unread messages */}
                      {unreadNewMessages > 0 && !isAtBottom && (
                        <button
                          className="text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full p-2 transition-colors shadow animate-bounce"
                          onClick={scrollToBottom}
                          title="Scroll to latest messages"
                          aria-label="Scroll to latest messages"
                        >
                          <FaCommentDots className="text-sm" />
                        </button>
                      )}
                      <button
                        className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full p-2 transition-colors z-10 shadow"
                        onClick={() => {
                          setShowChatModal(false);
                          // Close reactions bar when chat modal closes
                          setShowReactionsBar(false);
                          setReactionsMessageId(null);
                          // Clean up URL when chat closes
                          if (params.chatId) {
                            navigate('/admin/appointments', { replace: true });
                          }
                        }}
                        title="Close"
                        aria-label="Close"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Enhanced Search Header */}
              {showSearchBox && (
                <div className="enhanced-search-header bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 px-3 sm:px-4 py-3 border-b-2 border-blue-700 flex-shrink-0 animate-slideDown">
                  <div className="flex items-center gap-2 sm:gap-3 flex-nowrap">
                    {/* Calendar Search Icon */}
                    <div className="relative calendar-container">
                      <button
                        className="text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all duration-300 transform hover:scale-110 shadow"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCalendar(!showCalendar);
                        }}
                        title="Jump to date"
                        aria-label="Jump to date"
                      >
                        <FaCalendarAlt className="text-sm" />
                      </button>
                      {showCalendar && (
                        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[250px] animate-fadeIn"
                          style={{ zIndex: 9999 }}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Jump to Date</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCalendar(false);
                              }}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <FaTimes size={14} />
                            </button>
                          </div>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleDateSelect(e.target.value);
                            }}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            max={formatDateForInput(new Date())}
                          />
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Select a date to jump to the first message from that day
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Search Bar */}
                    <div className="flex-1 flex items-center gap-2 bg-white/20 rounded-full px-3 sm:px-4 py-2 backdrop-blur-sm min-w-0 overflow-hidden">
                      <FaSearch className="text-white/70 text-sm" />
                      <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                        onKeyDown={handleSearchKeyDown}
                        className="bg-transparent text-white placeholder-white/70 text-sm outline-none flex-1 min-w-0 w-full"
                        autoFocus
                      />
                      {searchResults.length > 0 && (
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <span className="text-white/80 text-xs bg-white/10 px-2 py-1 rounded-full">
                            {currentSearchIndex + 1}/{searchResults.length}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setCurrentSearchIndex(prev => prev > 0 ? prev - 1 : searchResults.length - 1)}
                              className="text-white/80 hover:text-white p-1 rounded transition-colors text-xs"
                              title="Previous result"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => setCurrentSearchIndex(prev => prev < searchResults.length - 1 ? prev + 1 : 0)}
                              className="text-white/80 hover:text-white p-1 rounded transition-colors text-xs"
                              title="Next result"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Close Icon */}
                    <button
                      onClick={() => {
                        setShowSearchBox(false);
                        setSearchQuery("");
                        setSearchResults([]);
                        setCurrentSearchIndex(-1);
                        setShowCalendar(false);
                        // Clear any existing text highlights
                        document.querySelectorAll('.search-text-highlight').forEach(el => {
                          el.outerHTML = el.innerHTML;
                        });
                      }}
                      className="flex-shrink-0 text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all duration-300 transform hover:scale-110 shadow"
                      title="Close search"
                      aria-label="Close search"
                    >
                      <FaTimes className="text-sm" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col min-h-0 relative">
                {isDragOver && (
                  <div className="absolute inset-0 bg-transparent backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white animate-fadeIn pointer-events-none">
                    <div className="relative flex items-center justify-center w-40 h-40 mb-6">
                      {/* Music Note Icon (Far Left) */}
                      <div className="absolute w-16 h-16 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl shadow-lg flex items-center justify-center transform -rotate-20 -translate-x-16 translate-y-3 border border-white/20 z-10">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                      {/* Document Icon (Left/Center) */}
                      <div className="absolute w-16 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-xl flex flex-col justify-between p-3 transform -rotate-6 -translate-x-5 -translate-y-4 border border-white/20 z-20">
                        <div className="w-6 h-1.5 bg-white/40 rounded"></div>
                        <div className="space-y-1.5 flex-1 mt-3">
                          <div className="w-full h-1 bg-white/70 rounded"></div>
                          <div className="w-full h-1 bg-white/70 rounded"></div>
                          <div className="w-3/4 h-1 bg-white/70 rounded"></div>
                        </div>
                      </div>
                      {/* Video Play Icon (Right/Center) */}
                      <div className="absolute w-16 h-16 bg-gradient-to-tr from-red-500 to-orange-500 rounded-xl shadow-2xl flex items-center justify-center transform rotate-6 translate-x-5 -translate-y-3 border border-white/20 z-30">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polygon points="10 8 16 12 10 16 10 8" />
                        </svg>
                      </div>
                      {/* Image Icon (Far Right) */}
                      <div className="absolute w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-2xl flex items-center justify-center transform rotate-20 translate-x-16 translate-y-3 border border-white/20 z-40">
                        <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Add anything</h3>
                    <p className="text-gray-300 text-sm max-w-xs text-center px-4">
                      Drop any file here to add it to the conversation
                    </p>
                  </div>
                )}
                <div
                  ref={chatContainerRef}
                  className={`flex-1 overflow-y-auto space-y-2 px-4 pt-4 animate-fadeInChat relative bg-gradient-to-b from-transparent to-blue-50/30 dark:to-blue-950/30 ${isDragOver ? 'bg-blue-50/50 dark:bg-blue-950/50 border-2 border-dashed border-blue-300 dark:border-blue-700' : ''}`}
                  style={{ minHeight: '400px', maxHeight: 'calc(100vh - 200px)' }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setIsDragOver(false);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(false);

                    const files = Array.from(e.dataTransfer.files);
                    const imageFiles = files.filter(file => file.type.startsWith('image/'));

                    if (imageFiles.length > 0) {
                      handleImageFiles(imageFiles);
                    } else if (files.length > 0) {
                      toast.error('Only image files are supported');
                    }
                  }}
                >
                {/* Privacy Notice for Admins */}
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/40 dark:to-purple-900/40 border-l-4 border-blue-400 rounded-r-lg mb-4 backdrop-blur-sm">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium text-center flex items-center justify-center gap-2">
                    <span className="animate-gentlePulse">🔒</span>
                    Chats are encrypted and secure. View only for valid purposes like disputes or fraud checks. Unauthorized access or sharing is prohibited and will be logged.
                  </p>
                </div>

                {/* Pinned Messages Section removed */}

                {/* Floating Date Indicator */}
                {currentFloatingDate && localComments.length > 0 && (
                  <div className={`sticky top-0 left-0 right-0 z-30 pointer-events-none transition-all duration-300 ease-in-out ${isScrolling ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    }`}>
                    <div className="w-full flex justify-center py-2">
                      <div className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white">
                        {currentFloatingDate}
                      </div>
                    </div>
                  </div>
                )}
                {(() => {
                  const mergedTimeline = [
                    // Convert chat messages to timeline items
                    ...localComments.map(msg => ({
                      type: 'message',
                      id: msg._id,
                      timestamp: new Date(msg.timestamp),
                      message: msg,
                      sortTime: new Date(msg.timestamp).getTime()
                    }))
                  ].sort((a, b) => a.sortTime - b.sortTime); // Sort chronologically

                  // If no items at all
                  if (mergedTimeline.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <FaCommentDots className="text-gray-300 dark:text-gray-600 text-4xl mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No messages in this conversation</p>
                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Monitor and manage communication between parties</p>
                      </div>
                    );
                  }

                  // Render visible items
                  const visibleItems = mergedTimeline.slice(Math.max(0, mergedTimeline.length - Math.min(visibleCount, mergedTimeline.length)));
                  const hasOlderMessages = mergedTimeline.length > visibleItems.length;

                  return (
                    <>
                      {/* Loading older messages indicator */}
                      {isLoadingOlderMessages && (
                        <div className="flex justify-center py-3 animate-fadeIn">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg bg-gray-800/90 border-gray-700 text-blue-400 backdrop-blur-md">
                            <UrbanSetuSpinner size="sm" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Loading History</span>
                          </div>
                        </div>
                      )}

                      {/* "Load earlier messages" banner when there are older messages not yet rendered */}
                      {hasOlderMessages && !isLoadingOlderMessages && (
                        <div className="flex justify-center py-2">
                          <button
                            onClick={() => {
                              loadingOlderRef.current = true;
                              setIsLoadingOlderMessages(true);
                              const container = chatContainerRef.current;
                              const prevHeight = container ? container.scrollHeight : 0;
                              setTimeout(() => {
                                setVisibleCount(prev => Math.min(prev + MESSAGES_PAGE_SIZE, localComments.length));
                                requestAnimationFrame(() => {
                                  if (container) {
                                    const newHeight = container.scrollHeight;
                                    container.scrollTop = newHeight - prevHeight;
                                  }
                                  setIsLoadingOlderMessages(false);
                                  setTimeout(() => { loadingOlderRef.current = false; }, 300);
                                });
                              }, 150);
                            }}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-blue-400 bg-gray-800/60 border border-gray-700 hover:bg-gray-700/80 hover:text-blue-300 transition-all duration-200 shadow-md hover:shadow-lg"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            Load earlier messages ({mergedTimeline.length - visibleItems.length} more)
                          </button>
                        </div>
                      )}

                      {visibleItems.map((item, mapIndex) => {
                    const index = mergedTimeline.length - visibleItems.length + mapIndex;
                    const previousItem = index > 0 ? mergedTimeline[index - 1] : null;
                    const currentDate = item.timestamp;
                    const previousDate = previousItem ? previousItem.timestamp : null;
                    const isNewDay = previousDate ? currentDate.toDateString() !== previousDate.toDateString() : true;


                    // If it's a message, render chat message (existing logic)
                    const c = item.message;
                    const isMe = c && c.senderEmail === currentUser.email;
                    const isEditing = editingComment === (c && c._id);
                    const formattedDate = currentDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });

                    return (
                      <React.Fragment key={c._id || index}>
                        {isNewDay && (
                          <div className="w-full flex justify-center my-2">
                            <span className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg border-2 border-white dark:border-gray-700">{getDateLabel(currentDate)}</span>
                          </div>
                        )}
                        {/* New messages divider */}
                        {unreadNewMessages > 0 && item.type === 'message' && (() => {
                          const messageIndex = localComments.findIndex(msg => msg._id === c._id);
                          return messageIndex === localComments.length - unreadNewMessages;
                        })() && (
                            <div className="w-full flex items-center my-2">
                              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
                              <span className="mx-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full border border-red-200 dark:border-red-800">
                                New messages
                              </span>
                              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
                            </div>
                          )}
                        <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-fadeInChatBubble`} style={{ animationDelay: `${0.03 * index}s` }}>
                          {/* Selection checkbox - only show in selection mode */}
                          {isSelectionMode && (
                            <div className={`flex items-start ${isMe ? 'order-2 ml-2' : 'order-1 mr-2'}`}>
                              <input
                                type="checkbox"
                                checked={selectedMessages.some(msg => msg._id === c._id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMessages(prev => [...prev, c]);
                                  } else {
                                    setSelectedMessages(prev => prev.filter(msg => msg._id !== c._id));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                            </div>
                          )}
                          <div
                            ref={el => messageRefs.current[c && c._id ? c._id : 'unknown'] = el}
                            data-message-id={c && c._id ? c._id : 'unknown'}
                            className={`relative rounded-2xl px-4 sm:px-5 shadow-xl max-w-[90%] sm:max-w-[80%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] break-words overflow-visible transition-all duration-300 min-h-[60px] ${c && c.audioUrl ? 'min-w-[280px] sm:min-w-[320px]' : ''} ${settings.messageDensity === 'compact' ? 'py-1' : settings.messageDensity === 'spacious' ? 'py-5' : 'py-3'
                              } ${settings.fontSize === 'small' ? 'text-xs' : settings.fontSize === 'large' ? 'text-base' : 'text-sm'
                              } ${isMe
                                ? 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white shadow-blue-200 dark:shadow-blue-900/20 hover:shadow-blue-300 dark:hover:shadow-blue-900/40 hover:shadow-2xl'
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shadow-gray-200 dark:shadow-black/20 hover:shadow-lg dark:hover:shadow-black/40 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xl'
                              } ${isSelectionMode && selectedMessages.some(msg => msg._id === (c && c._id)) ? 'ring-2 ring-blue-400' : ''}`}
                          >

                            {/* Reply preview above message if this is a reply */}
                            {c && c.replyTo && (() => {
                              // Check if replyTo is a call (starts with "call-")
                              const isCallReply = c.replyTo.startsWith('call-');
                              let repliedMessage = null;

                              if (isCallReply) {
                                // Look for the call in callHistory
                                const callId = c.replyTo.replace('call-', '');
                                const repliedCall = callHistory.find(call =>
                                  (call._id || call.callId) === callId
                                );
                                if (repliedCall) {
                                  repliedMessage = {
                                    message: `${repliedCall.callType === 'video' ? 'Video' : 'Audio'} call`
                                  };
                                }
                              } else {
                                // Look for the message in localComments
                                repliedMessage = localComments.find(msg => msg._id === (c && c.replyTo));
                              }

                              const getCleanRepliedMessage = (msgText) => {
                                if (!msgText) return 'Original message';
                                return msgText
                                  .replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1')
                                  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
                              };

                              const cleanMsgText = getCleanRepliedMessage(repliedMessage?.message);

                              return (
                                <div className="border-l-4 border-purple-400 pl-3 mb-2 text-xs bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/50 dark:hover:to-blue-900/50 rounded-lg w-full max-w-full break-words cursor-pointer transition-all duration-200 hover:shadow-sm" onClick={() => {
                                  if (c && c.replyTo && messageRefs.current[c.replyTo]) {
                                    messageRefs.current[c.replyTo].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    messageRefs.current[c.replyTo].classList.add('reply-highlight');
                                    setTimeout(() => {
                                      messageRefs.current[c.replyTo]?.classList.remove('reply-highlight');
                                    }, 1600);
                                  }
                                }} role="button" tabIndex={0} aria-label="Go to replied message">
                                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate max-w-[150px] flex items-center gap-1">
                                    <span className="text-purple-500">↩</span>
                                    {cleanMsgText.substring(0, 30)}{cleanMsgText.length > 30 ? '...' : ''}
                                  </span>
                                </div>
                              );
                            })()}
                            <div className="font-semibold mb-2 flex items-center gap-2 justify-start text-left">
                              <span className={`truncate max-w-[120px] min-w-[60px] inline-block align-middle overflow-hidden text-ellipsis text-left ${isMe ? 'text-blue-100' : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                {isMe ? "You" : (() => {
                                  // Check if sender is buyer or seller to get their name
                                  const isSenderBuyer = c && c.senderEmail === appt.buyerId?.email;
                                  const isSenderSeller = c && c.senderEmail === appt.sellerId?.email;

                                  if (isSenderBuyer) {
                                    return appt.buyerId?.username || (c && c.senderName) || (c && c.senderEmail);
                                  } else if (isSenderSeller) {
                                    return appt.sellerId?.username || (c && c.senderName) || (c && c.senderEmail);
                                  } else {
                                    // Sender is neither buyer nor seller (could be another admin)
                                    return (c && c.senderName) || (c && c.senderEmail);
                                  }
                                })()}
                              </span>
                            </div>
                            <div className={`text-left ${isMe ? 'font-medium' : ''} ${settings.fontSize === 'small' ? 'text-sm' : settings.fontSize === 'large' ? 'text-lg' : 'text-base'
                              }`}>
                              {c && c.deleted ? (
                                (() => {
                                  // Check if admin has hidden this deleted message locally using state
                                  const locallyHidden = c && hiddenMessageIds.includes(c._id);
                                  if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
                                    if (locallyHidden) {
                                      // Show collapsed placeholder for hidden deleted message
                                      return (
                                        <div className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800/50 rounded p-2 mb-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-gray-600 text-xs">
                                              <FaBan className="inline-block" />
                                              <span>Deleted message hidden from view</span>
                                            </div>
                                            <button
                                              className="text-xs text-blue-500 hover:text-blue-700 underline"
                                              onClick={() => showMessage(c._id)}
                                              title="Show this deleted message content"
                                            >
                                              Show
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Show full deleted message content
                                    return (
                                      <div className="border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded p-2 mb-2">
                                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold mb-1">
                                          <FaBan className="inline-block" />
                                          Message deleted by {(c && c.deletedBy) || 'user'} (Admin view - preserved for records)
                                        </div>

                                        {/* Show preserved image if exists */}
                                        {c && (c.originalImageUrl || c.imageUrl) && (
                                          <div className="mb-2">
                                            <img
                                              src={(c && c.originalImageUrl) || (c && c.imageUrl)}
                                              alt="Preserved image from deleted message"
                                              className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                              onClick={() => {
                                                const chatImages = (localComments || []).filter(msg => !!(msg.originalImageUrl || msg.imageUrl)).map(msg => msg.originalImageUrl || msg.imageUrl);
                                                const currentUrl = (c && c.originalImageUrl) || (c && c.imageUrl);
                                                const startIndex = Math.max(0, chatImages.indexOf(currentUrl));
                                                setPreviewImages(chatImages);
                                                setPreviewIndex(startIndex);
                                                setShowImagePreview(true);
                                              }}
                                              onError={(e) => {
                                                e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                                e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                              }}
                                            />
                                          </div>
                                        )}

                                        {/* Show preserved video if exists */}
                                        {c && c.videoUrl && (
                                          <div className="mb-2">
                                            <video
                                              src={c.videoUrl}
                                              className="max-w-full max-h-64 rounded-lg border dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                                              controls
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (e.target.requestFullscreen) {
                                                  e.target.requestFullscreen();
                                                } else if (e.target.webkitRequestFullscreen) {
                                                  e.target.webkitRequestFullscreen();
                                                }
                                              }}
                                            />
                                            <div className="mt-1 text-xs text-gray-600 italic">
                                              Preserved video from deleted message
                                            </div>
                                          </div>
                                        )}

                                        {/* Show preserved audio if exists */}
                                        {c && c.audioUrl && (
                                          <div className="mb-2">
                                            <div className="bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                                              <audio
                                                src={c.audioUrl}
                                                className="w-full"
                                                controls
                                                preload="metadata"
                                              />
                                              <div className="mt-2 text-xs text-gray-600 italic">
                                                Preserved audio from deleted message: {c.audioName || 'Audio file'}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Show preserved document if exists */}
                                        {c && c.documentUrl && (
                                          <div className="mb-2">
                                            <div className="bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                                              <div className="flex items-center gap-2 mb-2">
                                                <div className="flex-1 flex items-center gap-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded transition-colors"
                                                  onClick={() => {
                                                    // Construct preview URL
                                                    const ext = c.documentUrl.split('.').pop().toLowerCase();
                                                    let type = 'document';
                                                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
                                                    else if (ext === 'pdf') type = 'pdf';

                                                    // Open preview in new tab
                                                    const previewUrl = `/admin/view-chat/preview?url=${encodeURIComponent(c.documentUrl)}&name=${encodeURIComponent(c.documentName || 'Document')}&type=${type}&source=admin_appointments`;
                                                    window.open(previewUrl, '_blank');
                                                  }}
                                                >
                                                  <span className="text-2xl">📄</span>
                                                  <div>
                                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 underline">
                                                      {c.documentName || 'Document'}
                                                    </div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                                                      Preserved document from deleted message
                                                    </div>
                                                  </div>
                                                </div>
                                                <button
                                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const ext = c.documentUrl.split('.').pop().toLowerCase();
                                                    let type = 'document';
                                                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
                                                    else if (ext === 'pdf') type = 'pdf';
                                                    const previewUrl = `/view-chat/preview?url=${encodeURIComponent(c.documentUrl)}&name=${encodeURIComponent(c.documentName || 'Document')}&type=${type}&source=admin_appointments`;
                                                    window.open(previewUrl, '_blank');
                                                  }}
                                                >
                                                  View Document
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        {/* Download option for audio messages */}
                                        {selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl && (
                                          <button
                                            className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                            onClick={async () => {
                                              try {
                                                const response = await authenticatedFetch(selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl, { mode: 'cors' });
                                                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                const blob = await response.blob();
                                                const blobUrl = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = blobUrl;
                                                a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}`;
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                                toast.success('Audio downloaded successfully');
                                              } catch (error) {
                                                const a = document.createElement('a');
                                                a.href = selectedMessageForHeaderOptions && selectedMessageForHeaderOptions.audioUrl;
                                                a.download = selectedMessageForHeaderOptions.audioName || `audio-${selectedMessageForHeaderOptions && selectedMessageForHeaderOptions._id || Date.now()}`;
                                                a.target = '_blank';
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                toast.success('Audio download started');
                                              }
                                              setShowHeaderMoreMenu(false);
                                              setHeaderOptionsMessageId(null);
                                            }}
                                          >
                                            <FaDownload className="text-sm" />
                                            Download Audio
                                          </button>
                                        )}

                                        <div className="text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border-l-4 border-red-400 dark:border-red-800 relative group">
                                          {(() => {
                                            const messageContent = (c && c.originalMessage) || (c && c.message);
                                            if (messageContent) {
                                              return (
                                                <>
                                                  <span className="whitespace-pre-wrap break-words">{messageContent}</span>
                                                  {/* Copy icon - visible on hover */}
                                                  <button
                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded p-1 shadow-sm"
                                                    onClick={() => copyMessageToClipboard(messageContent)}
                                                    title="Copy deleted message content"
                                                    aria-label="Copy deleted message content"
                                                  >
                                                    <FaCopy className="text-xs" />
                                                  </button>
                                                </>
                                              );
                                            } else {
                                              return (
                                                <span className="text-gray-500 dark:text-gray-400 italic">
                                                  [Message content not preserved - this message was deleted before content preservation was implemented]
                                                </span>
                                              );
                                            }
                                          })()}
                                        </div>

                                        <button
                                          className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                                          onClick={() => hideMessage(c._id)}
                                          title="Hide this deleted message from your admin view"
                                        >
                                          Hide from admin view
                                        </button>
                                      </div>
                                    );
                                  } else {
                                    // Regular users see standard deletion message
                                    return (
                                      <span className="flex items-center gap-1 text-gray-400 italic">
                                        <FaBan className="inline-block text-lg" /> This message has been deleted.
                                      </span>
                                    );
                                  }
                                })()
                              ) : (
                                <div>
                                  {isEditing ? (
                                    <div className="bg-yellow-100 border-l-4 border-yellow-400 px-2 py-1 rounded">
                                      <span className="text-yellow-800 text-xs font-medium">✏️ Editing this message below...</span>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Image Message - Show preserved image if message is deleted */}
                                      {c && (c.originalImageUrl || c.imageUrl) && (
                                        <div className="mb-2">
                                          <img
                                            src={(c && c.originalImageUrl) || (c && c.imageUrl)}
                                            alt="Shared image"
                                            className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => {
                                              const chatImages = (localComments || []).filter(msg => !!(msg.originalImageUrl || msg.imageUrl)).map(msg => msg.originalImageUrl || msg.imageUrl);
                                              const currentUrl = (c && c.originalImageUrl) || (c && c.imageUrl);
                                              const startIndex = Math.max(0, chatImages.indexOf(currentUrl));
                                              setPreviewImages(chatImages);
                                              setPreviewIndex(startIndex);
                                              setShowImagePreview(true);
                                            }}
                                            onError={(e) => {
                                              e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                              e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                            }}
                                          />
                                        </div>
                                      )}
                                      {/* Video Message */}
                                      {c && c.videoUrl && (
                                        <VideoMessageBubble
                                          videoUrl={c.videoUrl}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const videoUrls = (localComments || []).filter(msg => !!msg.videoUrl && !msg.deleted).map(msg => msg.videoUrl);
                                            const startIndex = Math.max(0, videoUrls.indexOf(c.videoUrl));
                                            window.dispatchEvent(new CustomEvent('open-media-preview', {
                                              detail: {
                                                videos: videoUrls,
                                                index: startIndex
                                              }
                                            }));
                                          }}
                                        />
                                      )}
                                      {/* Audio Message */}
                                      {c && c.audioUrl && (
                                        <div className="mb-2">
                                          <div className="relative">
                                            <div className="w-full min-w-[280px] sm:min-w-[320px]">
                                              <audio
                                                src={c && c.audioUrl ? c.audioUrl : ''}
                                                className="w-full"
                                                controls
                                                preload="metadata"
                                                onClick={(e) => e.stopPropagation()}
                                                ref={(audioEl) => {
                                                  if (audioEl && !audioEl.dataset.audioId) {
                                                    audioEl.dataset.audioId = c._id;

                                                    // Add play event listener to pause other audios
                                                    audioEl.addEventListener('play', () => {
                                                      // Pause all other audio elements
                                                      document.querySelectorAll('audio[data-audio-id]').forEach(otherAudio => {
                                                        if (otherAudio !== audioEl && !otherAudio.paused) {
                                                          otherAudio.pause();
                                                        }
                                                      });
                                                    });

                                                    // Add playback rate change listener
                                                    audioEl.addEventListener('ratechange', () => {
                                                      const rate = audioEl.playbackRate;
                                                      const rateDisplay = document.querySelector(`[data-audio-id="${c._id}"].playback-rate-display`);
                                                      if (rateDisplay) {
                                                        rateDisplay.textContent = `${rate}x`;
                                                      }
                                                      // Update active speed in dropdown
                                                      const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                      if (speedMenu) {
                                                        const speedButtons = speedMenu.querySelectorAll('[data-speed-option]');
                                                        speedButtons.forEach(btn => {
                                                          btn.classList.remove('bg-blue-100', 'text-blue-700');
                                                          btn.classList.add('text-gray-700', 'hover:bg-gray-100');
                                                          if (parseFloat(btn.dataset.speedOption) === rate) {
                                                            btn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                                                            btn.classList.add('bg-blue-100', 'text-blue-700');
                                                          }
                                                        });
                                                      }
                                                    });

                                                    // Set initial speed display
                                                    const rateDisplay = document.querySelector(`[data-audio-id="${c._id}"].playback-rate-display`);
                                                    if (rateDisplay) {
                                                      rateDisplay.textContent = `${audioEl.playbackRate}x`;
                                                    }
                                                  }
                                                }}
                                              />
                                            </div>
                                            <div className="mt-2 flex justify-between items-center">
                                              <div className="flex items-center gap-2">
                                                <button
                                                  className={`px-3 py-1.5 text-xs rounded-full shadow-sm border transition-colors ${isMe ? 'bg-white text-blue-600 hover:bg-blue-50 border-blue-200' : 'bg-blue-600 text-white hover:bg-blue-700 border-transparent'}`}
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                      const response = await authenticatedFetch(c && c.audioUrl ? c.audioUrl : '', { mode: 'cors' });
                                                      if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                      const blob = await response.blob();
                                                      const blobUrl = window.URL.createObjectURL(blob);
                                                      const a = document.createElement('a');
                                                      a.href = blobUrl;
                                                      a.download = (c && c.audioName) || `audio-${(c && c._id) || Date.now()}`;
                                                      document.body.appendChild(a);
                                                      a.click();
                                                      a.remove();
                                                      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                                      toast.success('Audio downloaded successfully');
                                                    } catch (error) {
                                                      const a = document.createElement('a');
                                                      a.href = c && c.audioUrl ? c.audioUrl : '';
                                                      a.download = (c && c.audioName) || `audio-${(c && c._id) || Date.now()}`;
                                                      a.target = '_blank';
                                                      document.body.appendChild(a);
                                                      a.click();
                                                      a.remove();
                                                      toast.success('Audio download started');
                                                    }
                                                  }}
                                                  title="Download audio"
                                                >
                                                  <span className="inline-flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
                                                    Download
                                                  </span>
                                                </button>
                                                <span className={`text-xs playback-rate-display ${isMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`} data-audio-id={c._id}>1x</span>
                                              </div>

                                              {/* Three dots menu for audio options */}
                                              <div className="relative">
                                                <button
                                                  className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${isMe ? 'text-white hover:bg-blue-500' : 'text-gray-600 hover:bg-gray-200'}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const menu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                    if (menu) {
                                                      menu.classList.toggle('hidden');
                                                      // Close other audio menus when opening this one
                                                      if (!menu.classList.contains('hidden')) {
                                                        document.querySelectorAll('[data-audio-menu]').forEach(otherMenu => {
                                                          if (otherMenu !== menu) {
                                                            otherMenu.classList.add('hidden');
                                                          }
                                                        });
                                                      }
                                                    }
                                                  }}
                                                  title="Audio options"
                                                >
                                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                                  </svg>
                                                </button>

                                                {/* Audio options dropdown - Main Menu */}
                                                <div
                                                  data-audio-menu={c._id}
                                                  className="hidden absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]"
                                                >
                                                  <div className="py-1">
                                                    <button
                                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                        const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                        if (mainMenu && speedMenu) {
                                                          mainMenu.classList.add('hidden');
                                                          speedMenu.classList.remove('hidden');
                                                        }
                                                      }}
                                                    >
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                      </svg>
                                                      Playback Speed
                                                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                      </svg>
                                                    </button>

                                                    <button
                                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                        const controlsMenu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                        if (mainMenu && controlsMenu) {
                                                          mainMenu.classList.add('hidden');
                                                          controlsMenu.classList.remove('hidden');
                                                        }
                                                      }}
                                                    >
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                                      </svg>
                                                      Audio Controls
                                                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                      </svg>
                                                    </button>
                                                  </div>
                                                </div>

                                                {/* Audio Speed Menu */}
                                                <div
                                                  data-audio-speed-menu={c._id}
                                                  className="hidden absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]"
                                                >
                                                  <div className="py-1">
                                                    <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                                      <button
                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                          const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                          if (mainMenu && speedMenu) {
                                                            speedMenu.classList.add('hidden');
                                                            mainMenu.classList.remove('hidden');
                                                          }
                                                        }}
                                                      >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                        </svg>
                                                      </button>
                                                      Playback Speed
                                                    </div>
                                                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                                                      <button
                                                        key={speed}
                                                        data-speed-option={speed}
                                                        className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${speed === 1 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                          }`}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                          if (audioEl) {
                                                            audioEl.playbackRate = speed;
                                                            // Update speed display immediately
                                                            const rateDisplay = document.querySelector(`[data-audio-id="${c._id}"].playback-rate-display`);
                                                            if (rateDisplay) {
                                                              rateDisplay.textContent = `${speed}x`;
                                                            }
                                                          }

                                                          // Update highlighting in the speed menu
                                                          const menu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                          if (menu) {
                                                            // Remove highlighting from all speed buttons
                                                            const speedButtons = menu.querySelectorAll('[data-speed-option]');
                                                            speedButtons.forEach(btn => {
                                                              btn.classList.remove('bg-blue-100', 'text-blue-700');
                                                              btn.classList.add('text-gray-700', 'hover:bg-gray-100');
                                                            });

                                                            // Add highlighting to the selected speed button
                                                            const selectedButton = menu.querySelector(`[data-speed-option="${speed}"]`);
                                                            if (selectedButton) {
                                                              selectedButton.classList.remove('text-gray-700', 'hover:bg-gray-100');
                                                              selectedButton.classList.add('bg-blue-100', 'text-blue-700');
                                                            }
                                                          }

                                                          const speedMenu = document.querySelector(`[data-audio-speed-menu="${c._id}"]`);
                                                          if (speedMenu) {
                                                            speedMenu.classList.add('hidden');
                                                          }
                                                        }}
                                                      >
                                                        <span>{speed}x</span>
                                                        {speed === 1 && <span className="text-xs text-gray-400">Normal</span>}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>

                                                {/* Audio Controls Menu */}
                                                <div
                                                  data-audio-controls-menu={c._id}
                                                  className="hidden absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]"
                                                >
                                                  <div className="py-1">
                                                    <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                                      <button
                                                        className="p-1 hover:bg-gray-100 rounded"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          const mainMenu = document.querySelector(`[data-audio-menu="${c._id}"]`);
                                                          const controlsMenu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                          if (mainMenu && controlsMenu) {
                                                            controlsMenu.classList.add('hidden');
                                                            mainMenu.classList.remove('hidden');
                                                          }
                                                        }}
                                                      >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                        </svg>
                                                      </button>
                                                      Audio Controls
                                                    </div>

                                                    <button
                                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                        if (audioEl) {
                                                          if (audioEl.paused) {
                                                            audioEl.play();
                                                          } else {
                                                            audioEl.pause();
                                                          }
                                                        }
                                                        const menu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                        if (menu) {
                                                          menu.classList.add('hidden');
                                                        }
                                                      }}
                                                    >
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                                      </svg>
                                                      Toggle Play/Pause
                                                    </button>

                                                    <button
                                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                        if (audioEl) {
                                                          audioEl.currentTime = 0;
                                                        }
                                                        const menu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                        if (menu) {
                                                          menu.classList.add('hidden');
                                                        }
                                                      }}
                                                    >
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                      </svg>
                                                      Restart Audio
                                                    </button>

                                                    <button
                                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const audioEl = document.querySelector(`[data-audio-id="${c._id}"]`);
                                                        if (audioEl) {
                                                          audioEl.muted = !audioEl.muted;
                                                        }
                                                        const menu = document.querySelector(`[data-audio-controls-menu="${c._id}"]`);
                                                        if (menu) {
                                                          menu.classList.add('hidden');
                                                        }
                                                      }}
                                                    >
                                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                                      </svg>
                                                      Toggle Mute/Unmute
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          {c && c.message && (
                                            <div className={`mt-2 text-sm whitespace-pre-wrap break-words ${isMe ? 'text-white' : 'text-gray-700'}`}>
                                              {c && c.message}
                                              {c && c.edited && (
                                                <span className={`ml-2 text-[10px] italic whitespace-nowrap ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>(Edited)</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {/* Document Message */}
                                      {c && c.documentUrl && (
                                        <div className="mb-2 group relative flex items-center bg-gray-50/90 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-500 text-gray-800 dark:text-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all w-fit max-w-[85%] sm:max-w-[320px]">
                                          {/* Clickable Area for View */}
                                          <div
                                            className="flex-1 flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50/30 transition-colors min-w-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              // Construct preview URL
                                              const cleanUrl = (c.documentUrl || '').split('?')[0];
                                              const ext = cleanUrl.split('.').pop().toLowerCase();
                                              let type = 'document';
                                              if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
                                              // Open preview in new tab
                                              const previewUrl = `/admin/view-chat/preview?url=${encodeURIComponent(c.documentUrl)}&name=${encodeURIComponent(c.documentName || 'Document')}&type=${type}&appointmentId=${appt._id}&source=admin_appointments`;
                                              window.open(previewUrl, '_blank');
                                            }}
                                            title="Click to view document"
                                          >
                                            <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg text-blue-600 dark:text-blue-400 flex-shrink-0">
                                              <FaFileAlt size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0 overflow-hidden">
                                              <span className="text-sm font-medium truncate text-gray-900 dark:text-gray-100 w-full text-left">{c.documentName || 'Document'}</span>
                                            </div>
                                          </div>

                                          {/* Separator */}
                                          <div className="w-[1px] h-8 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

                                          {/* Download Button */}
                                          <button
                                            className="p-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0 z-10"
                                            title="Download"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                const response = await authenticatedFetch(c && c.documentUrl ? c.documentUrl : '', { mode: 'cors' });
                                                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                const blob = await response.blob();
                                                const blobUrl = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = blobUrl;
                                                a.download = (c && c.documentName) || `document-${(c && c._id) || Date.now()}`;
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                                toast.success('Document downloaded successfully');
                                              } catch (error) {
                                                console.error('Download failed:', error);
                                                const a = document.createElement('a');
                                                a.href = c && c.documentUrl ? c.documentUrl : '';
                                                a.download = (c && c.documentName) || `document-${(c && c._id) || Date.now()}`;
                                                a.target = '_blank';
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                toast.success('Document download started');
                                              }
                                            }}
                                          >
                                            <FaDownload size={14} />
                                          </button>
                                        </div>
                                      )}
                                      {/* Link Preview in Message */}
                                      {(() => {
                                        // Only show preview if it wasn't dismissed before sending
                                        if (c && c.previewDismissed) return null;

                                        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
                                        const urls = ((c && c.message) || '').match(urlRegex);
                                        if (urls && urls.length > 0) {
                                          return (
                                            <div className="mb-2 max-h-40 overflow-hidden">
                                              <LinkPreview
                                                url={urls[0]}
                                                className="max-w-xs"
                                                showRemoveButton={false}
                                                clickable={true}
                                                isSentMessage={isMe}
                                              />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}

                                      {/* Only show message text for non-audio messages (audio messages handle their caption internally) */}
                                      {c && !c.audioUrl && (
                                        <div className="inline">
                                          <FormattedTextWithReadMore
                                            text={(c && c.message || '').replace(/\n+$/, '')}
                                            isSentMessage={isMe}
                                            className="whitespace-pre-wrap break-words"
                                            searchQuery={searchQuery}
                                          />
                                          {c && c.edited && (
                                            <span className="ml-2 text-[10px] italic text-gray-300 whitespace-nowrap">(Edited)</span>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 justify-end mt-2" data-message-actions>
                              {/* Star icon for starred messages */}
                              {c && c.starredBy && c.starredBy.includes(currentUser._id) && (
                                <FaStar className={`${isMe ? 'text-yellow-300' : 'text-yellow-500'} text-[10px]`} />
                              )}
                              {settings.showTimestamps && (
                                <span className={`${isMe ? 'text-blue-200 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'} text-[10px]`}>
                                  {new Date(c && c.timestamp ? c.timestamp : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              )}
                              {/* Report flag right after time and before three dots */}
                              {reportedMessageIds?.includes(c && c._id) && (
                                <FaFlag
                                  className="text-red-500 w-3.5 h-3.5 mx-1 cursor-pointer hover:text-red-600 transition-colors"
                                  title="Reported message - hover for details"
                                  onMouseEnter={(e) => handleFlagHover(c._id, e)}
                                  onMouseLeave={handleFlagLeave}
                                />
                              )}
                              {/* Options icon - visible for all messages (including deleted) */}
                              <button
                                className={`${(c && c.senderEmail) === currentUser.email ? 'text-blue-200 hover:text-white dark:text-blue-300 dark:hover:text-blue-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'} transition-all duration-200 hover:scale-110 p-1 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/50 ml-1`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHeaderOptionsMessageId(c && c._id);
                                  toggleReactionsBar(c && c._id);
                                }}
                                title="Message options"
                                aria-label="Message options"
                              >
                                <FaEllipsisV size={12} />
                              </button>

                              {/* Display reactions */}
                              {c && !c.deleted && c.reactions && c.reactions.length > 0 && (
                                <div className="flex items-center gap-1 ml-1">
                                  {(() => {
                                    // Group reactions by emoji
                                    const groupedReactions = {};
                                    (c && c.reactions || []).forEach(reaction => {
                                      if (!groupedReactions[reaction.emoji]) {
                                        groupedReactions[reaction.emoji] = [];
                                      }
                                      groupedReactions[reaction.emoji].push(reaction);
                                    });

                                    return Object.entries(groupedReactions).map(([emoji, reactions]) => {
                                      const hasUserReaction = reactions.some(r => r.userId === currentUser._id);
                                      const userNames = reactions.map(r => r.userName).join(', ');

                                      return (
                                        <button
                                          key={emoji}
                                          onClick={() => handleQuickReaction(c && c._id, emoji)}
                                          className={`text-xs rounded-full px-2 py-1 flex items-center gap-1 transition-all duration-200 hover:scale-105 ${hasUserReaction
                                            ? 'bg-blue-500 border-2 border-blue-600 hover:bg-blue-600 shadow-md'
                                            : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            }`}
                                          title={`${userNames} reacted with ${emoji}${hasUserReaction ? ' (Click to remove)' : ' (Click to add)'}`}
                                        >
                                          <span>{emoji}</span>
                                          <span className={`${hasUserReaction ? 'text-white font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {reactions.length}
                                          </span>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                              )}

                              {/* Reactions Bar - positioned inside message container (above only) */}
                              {(() => {
                                const shouldShow = c && !c.deleted && showReactionsBar && reactionsMessageId === (c && c._id);
                                if (!shouldShow) return false;

                                // Only show inline reaction bar if message should be positioned above
                                const messageElement = document.querySelector(`[data-message-id="${c && c._id}"]`);
                                if (messageElement) {
                                  const messageRect = messageElement.getBoundingClientRect();
                                  const chatContainer = chatContainerRef.current;
                                  if (chatContainer) {
                                    const containerRect = chatContainer.getBoundingClientRect();
                                    const distanceFromTop = messageRect.top - containerRect.top;

                                    // If message is near top and has space below, don't show inline bar (floating bar will handle it)
                                    if (distanceFromTop < 120) {
                                      const spaceBelow = containerRect.bottom - messageRect.bottom;
                                      const reactionBarHeight = 60;

                                      if (spaceBelow >= reactionBarHeight + 20) {
                                        return false; // Don't show inline bar, floating bar will handle it
                                      }
                                    }
                                  }
                                }
                                return true; // Show inline bar for above positioning
                              })() && (
                                  <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} bg-red-500 dark:bg-red-900/40 rounded-full shadow-lg border-2 border-red-600 dark:border-red-800 p-1 flex items-center gap-1 animate-reactions-bar z-[999999] reactions-bar transition-all duration-300`} style={{ minWidth: 'max-content' }}>
                                    {/* Quick reaction buttons */}
                                    <button
                                      onClick={() => handleQuickReaction(c && c._id, '👍')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${(c && c.reactions)?.some(r => r.emoji === '👍' && r.userId === currentUser._id)
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                      title="Like"
                                    >
                                      👍
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c && c._id, '❤️')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${(c && c.reactions)?.some(r => r.emoji === '❤️' && r.userId === currentUser._id)
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                      title="Love"
                                    >
                                      ❤️
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c && c._id, '😂')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${(c && c.reactions)?.some(r => r.emoji === '😂' && r.userId === currentUser._id)
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                      title="Laugh"
                                    >
                                      😂
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c && c._id, '😮')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${(c && c.reactions)?.some(r => r.emoji === '😮' && r.userId === currentUser._id)
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                      title="Wow"
                                    >
                                      😮
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c && c._id, '😢')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${(c && c.reactions)?.some(r => r.emoji === '😢' && r.userId === currentUser._id)
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                      title="Sad"
                                    >
                                      😢
                                    </button>
                                    <button
                                      onClick={() => handleQuickReaction(c && c._id, '😡')}
                                      className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${(c && c.reactions)?.some(r => r.emoji === '😡' && r.userId === currentUser._id)
                                        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                      title="Angry"
                                    >
                                      😡
                                    </button>
                                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                                    <button
                                      onClick={toggleReactionsEmojiPicker}
                                      className="w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                                      title="More emojis"
                                    >
                                      ➕
                                    </button>
                                    {/* Appointment Reports removed from quick actions bar */}
                                  </div>
                                )}

                              {/* Read status indicator - always visible for sent messages */}
                              {c && (c.senderEmail === currentUser.email) && !c.deleted && (
                                <span className="ml-1 flex items-center gap-1">
                                  {(c && c.readBy)?.some(userId => userId !== currentUser._id)
                                    ? <FaCheckDouble className="text-green-400 text-xs transition-all duration-300 animate-fadeIn" title="Read" />
                                    : (c && c.status) === "delivered"
                                      ? <FaCheckDouble className="text-blue-200 text-xs transition-all duration-300 animate-fadeIn" title="Delivered" />
                                      : (c && c.status) === "sending"
                                        ? <FaCheckDouble className="text-blue-200 text-xs animate-pulse transition-all duration-300" title="Sending..." />
                                        : <FaCheck className="text-blue-200 text-xs transition-all duration-300 animate-fadeIn" title="Sent" />}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </>
              );
            })()}

                <div ref={chatEndRef} />
              </div>
              </div>

              {/* Floating Reaction Bar for Bottom Positioning */}
              {(() => {
                const shouldShow = showReactionsBar && reactionsMessageId;
                if (!shouldShow) return null;

                const messageElement = document.querySelector(`[data-message-id="${reactionsMessageId}"]`);
                if (!messageElement) return null;

                const messageRect = messageElement.getBoundingClientRect();
                const chatContainer = chatContainerRef.current;
                if (!chatContainer) return null;

                const containerRect = chatContainer.getBoundingClientRect();
                const distanceFromTop = messageRect.top - containerRect.top;

                // Only show floating bar if message is near top and needs bottom positioning
                if (distanceFromTop < 120) {
                  const spaceBelow = containerRect.bottom - messageRect.bottom;
                  const reactionBarHeight = 60;

                  if (spaceBelow >= reactionBarHeight + 20) {
                    const comment = localComments.find(c => c._id === reactionsMessageId);
                    if (!comment || comment.deleted) return null;

                    const isMe = comment.senderEmail === currentUser.email;

                    return (
                      <div
                        className="fixed bg-red-500 dark:bg-red-900/40 rounded-full shadow-lg border-2 border-red-600 dark:border-red-800 p-1 flex items-center gap-1 animate-reactions-bar z-[999999] reactions-bar transition-all duration-300"
                        style={{
                          minWidth: 'max-content',
                          top: `${messageRect.bottom + 2}px`,
                          left: isMe ? 'auto' : `${messageRect.left}px`,
                          right: isMe ? `${window.innerWidth - messageRect.right}px` : 'auto'
                        }}
                      >
                        {/* Quick reaction buttons */}
                        <button
                          onClick={() => handleQuickReaction(comment._id, '👍')}
                          className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${comment.reactions?.some(r => r.emoji === '👍' && r.userId === currentUser._id)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          title="Like"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '❤️')}
                          className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${comment.reactions?.some(r => r.emoji === '❤️' && r.userId === currentUser._id)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          title="Love"
                        >
                          ❤️
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😂')}
                          className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${comment.reactions?.some(r => r.emoji === '😂' && r.userId === currentUser._id)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          title="Laugh"
                        >
                          😂
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😮')}
                          className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${comment.reactions?.some(r => r.emoji === '😮' && r.userId === currentUser._id)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          title="Wow"
                        >
                          😮
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😢')}
                          className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${comment.reactions?.some(r => r.emoji === '😢' && r.userId === currentUser._id)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          title="Sad"
                        >
                          😢
                        </button>
                        <button
                          onClick={() => handleQuickReaction(comment._id, '😡')}
                          className={`w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform rounded-full ${comment.reactions?.some(r => r.emoji === '😡' && r.userId === currentUser._id)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400 dark:border-blue-500'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          title="Angry"
                        >
                          😡
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <button
                          onClick={toggleReactionsEmojiPicker}
                          className="w-8 h-8 flex items-center justify-center text-lg hover:scale-110 transition-transform bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                          title="More emojis"
                        >
                          ➕
                        </button>
                      </div>
                    );
                  }
                }
                return null;
              })()}

              {/* Quick Reactions Modal */}
              {showReactionsEmojiPicker && (
                <div
                  className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-[999999] animate-fadeIn"
                  onMouseDown={(e) => {
                    // Only close on backdrop mousedown, not modal content
                    if (e.target === e.currentTarget) {
                      setShowReactionsEmojiPicker(false);
                    }
                  }}
                  onClick={(e) => {
                    // Close modal only when clicking on backdrop, not modal content
                    if (e.target === e.currentTarget) {
                      setShowReactionsEmojiPicker(false);
                    }
                  }}
                >
                  <div
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden quick-reactions-modal"
                    onMouseDown={(e) => {
                      e.stopPropagation(); // Prevent any event bubbling
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent any event bubbling
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">Quick Reactions</div>
                      <button
                        onMouseDown={(e) => {
                          e.stopPropagation(); // Prevent event bubbling
                          e.preventDefault(); // Prevent default behavior
                        }}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent event bubbling
                          setShowReactionsEmojiPicker(false);
                          setReactionEmojiSearchTerm(''); // Clear search when closing
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 transition-colors"
                        title="Close"
                      >
                        <FaTimes size={16} />
                      </button>
                    </div>

                    {/* Search Box */}
                    <div className="mb-4">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search emojis..."
                          value={reactionEmojiSearchTerm}
                          onChange={(e) => setReactionEmojiSearchTerm(e.target.value)}
                          className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      {reactionEmojiSearchTerm && (
                        <div className="mt-2 text-sm text-gray-500">
                          {getFilteredEmojis(reactionEmojiSearchTerm).length} emoji{getFilteredEmojis(reactionEmojiSearchTerm).length !== 1 ? 's' : ''} found
                        </div>
                      )}
                    </div>
                    <div
                      className="overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800"
                      onMouseDown={(e) => {
                        e.stopPropagation(); // Prevent any event bubbling
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent any event bubbling
                      }}
                    >
                      <div
                        className="grid grid-cols-10 gap-2"
                        onMouseDown={(e) => {
                          e.stopPropagation(); // Prevent any event bubbling
                        }}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent any event bubbling
                        }}
                      >
                        {getFilteredEmojis(reactionEmojiSearchTerm).map((emoji, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (reactionsMessageId) {
                                handleQuickReaction(reactionsMessageId, emoji);
                                setShowReactionsEmojiPicker(false);
                                setShowReactionsBar(false);
                                setReactionsMessageId(null);
                              }
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            className="w-10 h-10 flex items-center justify-center text-xl hover:scale-110 transition-all duration-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reply indicator */}
              {replyTo && (
                <div className="px-4 mb-2">
                  <div className="flex items-center bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 px-2 py-1 rounded">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-semibold mr-2">Replying to:</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{replyTo.message?.substring(0, 40)}{replyTo.message?.length > 40 ? '...' : ''}</span>
                    <button className="ml-auto text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1 transition-colors" onClick={() => setReplyTo(null)} title="Cancel reply">
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}



              {/* Edit indicator */}
              {editingComment && (
                <div className="px-4 mb-2">
                  <div className="flex items-center bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 px-2 py-1 rounded">
                    <span className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold mr-2">✏️ Editing message:</span>
                    <span className="text-xs text-yellow-600 dark:text-yellow-500 truncate">{editText}</span>
                    <button
                      className="ml-auto text-yellow-400 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-200 bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 rounded-full p-1 transition-colors"
                      onClick={() => {
                        setEditingComment(null);
                        setEditText("");
                        // Restore original draft and clear it after a small delay to ensure state update
                        const draftToRestore = originalDraft;
                        setNewComment(draftToRestore);
                        setTimeout(() => {
                          setOriginalDraft(""); // Clear stored draft after restoration
                        }, 100);
                        setDetectedUrl(null);
                        setPreviewDismissed(false);
                        setLastDismissedUrl(null);
                        // Auto-resize textarea for restored draft with proper timing
                        setTimeout(() => {
                          if (inputRef.current) {
                            // Force a re-render by triggering the input event
                            const event = new Event('input', { bubbles: true });
                            inputRef.current.dispatchEvent(event);
                            // Reset height first, then calculate proper height
                            inputRef.current.style.height = '48px';
                            const scrollHeight = inputRef.current.scrollHeight;
                            const maxHeight = 144;

                            if (scrollHeight <= maxHeight) {
                              inputRef.current.style.height = scrollHeight + 'px';
                              inputRef.current.style.overflowY = 'hidden';
                            } else {
                              inputRef.current.style.height = maxHeight + 'px';
                              inputRef.current.style.overflowY = 'auto';
                            }
                          }
                        }, 100);
                      }}
                      title="Cancel edit"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />

              <div className="flex gap-2 mt-1 px-3 pb-2 flex-shrink-0 bg-gradient-to-b from-transparent to-white dark:to-gray-900 pt-2 items-end">
                {/* Message Input Container with Attachment and Emoji Icons Inside */}
                <div className="flex-1 relative">
                  {/* Link Preview Container with Height and Width Constraints */}
                  {detectedUrl && (
                    <div className="max-h-32 max-w-full overflow-y-auto mb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      <LinkPreview
                        url={detectedUrl}
                        onRemove={() => {
                          setLastDismissedUrl(detectedUrl);
                          setDetectedUrl(null);
                          setPreviewDismissed(true);
                        }}
                        className="w-full"
                        showRemoveButton={true}
                        clickable={false}
                      />
                    </div>
                  )}
                  {/* Formatting toolbar - Collapsible */}
                  {showTextStylingPanel && (
                    <div className="relative mb-2 animate-slideDown bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm">
                      {/* Close button */}
                      <button
                        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white hover:bg-opacity-50 dark:hover:bg-gray-800 rounded-full p-1 transition-colors z-10"
                        onClick={() => setShowTextStylingPanel(false)}
                        title="Close text styling panel"
                        aria-label="Close text styling panel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="flex flex-wrap items-center gap-2 pr-8">
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = newComment || ''; const selected = base.slice(start, end); const wrapped = `**${selected || 'bold'}**`; const next = base.slice(0, start) + wrapped + base.slice(end); setNewComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2 + (selected || 'bold').length); } catch (_) { } }, 0);
                          });
                        }}>B</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors italic" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = newComment || ''; const selected = base.slice(start, end); const wrapped = `*${selected || 'italic'}*`; const next = base.slice(0, start) + wrapped + base.slice(end); setNewComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 1, start + 1 + (selected || 'italic').length); } catch (_) { } }, 0);
                          });
                        }}>I</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors underline" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = newComment || ''; const selected = base.slice(start, end); const wrapped = `__${selected || 'underline'}__`; const next = base.slice(0, start) + wrapped + base.slice(end); setNewComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2 + (selected || 'underline').length); } catch (_) { } }, 0);
                          });
                        }}>U</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const end = el.selectionEnd || 0; const base = newComment || ''; const selected = base.slice(start, end); const wrapped = `~~${selected || 'strike'}~~`; const next = base.slice(0, start) + wrapped + base.slice(end); setNewComment(next); setTimeout(() => { try { el.focus(); el.setSelectionRange(start + 2, start + 2 + (selected || 'strike').length); } catch (_) { } }, 0);
                          });
                        }}>S</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const base = newComment || ''; const start = el.selectionStart || 0; setNewComment(base.slice(0, start) + `- ` + base.slice(start));
                          });
                        }}>• List</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" onClick={() => {
                          const el = inputRef.current; if (!el) return; const base = newComment || ''; const start = el.selectionStart || 0; const before = base.slice(0, start); const after = base.slice(start);
                          // Find existing numbered list items to determine next number
                          const lines = before.split('\n');
                          let nextNum = 1;

                          // Check if we're continuing a list
                          for (let i = lines.length - 1; i >= 0; i--) {
                            const line = lines[i].trim();
                            const match = line.match(/^(\d+)\.\s/);
                            if (match) {
                              nextNum = parseInt(match[1]) + 1;
                              break;
                            } else if (line && !line.match(/^\s*$/)) {
                              // Non-empty, non-numbered line found, reset to 1
                              break;
                            }
                          }

                          applyFormattingAndClose(() => {
                            setNewComment(base.slice(0, start) + `${nextNum}. ` + base.slice(start));
                          });
                        }}>1. List</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const base = newComment || ''; const start = el.selectionStart || 0; setNewComment(base.slice(0, start) + `> ` + base.slice(start));
                          });
                        }}>&gt; Quote</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" title="Tag Property" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = newComment || ''; const insert = '@'; setNewComment(base.slice(0, start) + insert + base.slice(start));
                          });
                        }}>@Prop</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" title="Insert appointment card" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = newComment || ''; const card = '[Appointment: date • time • with]'; setNewComment(base.slice(0, start) + card + base.slice(start));
                          });
                        }}>Appt</button>
                        <button type="button" className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors" title="Insert service link" onClick={() => {
                          applyFormattingAndClose(() => {
                            const el = inputRef.current; if (!el) return; const start = el.selectionStart || 0; const base = newComment || ''; const link = 'Book Movers: /user/movers'; setNewComment(base.slice(0, start) + link + base.slice(start));
                          });
                        }}>Service</button>
                      </div>
                    </div>
                  )}
                  {/* Property mention suggestions */}
                  {newComment && /@[^\s]*$/.test(newComment) && (
                    <div className="absolute bottom-16 left-2 right-2 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 rounded-lg shadow-2xl max-h-60 overflow-auto z-30 animate-fadeIn">
                      <div className="p-3 text-sm font-medium text-blue-600 dark:text-blue-400 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30">
                        <div className="flex items-center gap-2">
                          {(!propertiesLoaded || isLoadingBlogSuggestions) ? (
                            <UrbanSetuSpinner size="sm" />
                          ) : (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                          {(!propertiesLoaded || isLoadingBlogSuggestions) ? 'Loading content...' : 'Select content to reference:'}
                        </div>
                      </div>
                      {(() => {
                        const query = (newComment.match(/@([^\s]*)$/)?.[1] || '').toLowerCase();
                        const apptSource = (typeof appointments !== 'undefined' && Array.isArray(appointments) && appointments.length > 0) ? appointments : [appt].filter(Boolean);
                        const apptProps = apptSource.map(a => {
                          const l = a?.listingId && typeof a.listingId === 'object' ? a.listingId : {};
                          return {
                            id: a?.listingId?._id || a?.listingId,
                            name: a?.propertyName || l?.name || 'Property',
                            city: l?.city || 'City',
                            state: l?.state || 'State',
                            price: (l?.discountPrice ?? l?.regularPrice) || 0,
                            bedrooms: l?.bedrooms || 0,
                            bathrooms: l?.bathrooms || 0,
                            area: l?.area || 0,
                            image: Array.isArray(l?.imageUrls) ? l.imageUrls[0] : (l?.imageUrl || l?.image || null),
                            type: 'property'
                          };
                        });
                        const propList = Array.isArray(allProperties) ? allProperties : [];
                        const allPropsDetailed = propList.map(p => {
                          return {
                            id: p?.id,
                            name: p?.name || 'Property',
                            city: p?.city || 'City',
                            state: p?.state || 'State',
                            price: p?.price || 0,
                            bedrooms: p?.bedrooms || 0,
                            bathrooms: p?.bathrooms || 0,
                            area: p?.area || 0,
                            image: Array.isArray(p?.imageUrls) ? p.imageUrls[0] : (p?.imageUrl || p?.image || p?.thumbnail || null),
                            type: 'property'
                          };
                        });

                        const blogList = Array.isArray(allBlogs) ? allBlogs : [];
                        const filteredBlogs = blogList.map(b => ({
                          id: b.id,
                          name: b.name,
                          category: b.category,
                          image: b.image,
                          type: 'blog'
                        }));

                        // Combine everything
                        const combined = [...apptProps, ...allPropsDetailed, ...filteredBlogs];
                        const uniqueMap = new Map();

                        // Add appointment properties first (they have more complete data)
                        apptProps.forEach(prop => {
                          if (prop.id && prop.name) {
                            uniqueMap.set(`prop-${prop.id}`, prop);
                          }
                        });

                        // Add all properties, but don't override existing ones
                        allPropsDetailed.forEach(prop => {
                          if (prop.id && prop.name && !uniqueMap.has(`prop-${prop.id}`)) {
                            uniqueMap.set(`prop-${prop.id}`, prop);
                          }
                        });


                        // Add blogs
                        filteredBlogs.forEach(blog => {
                          if (blog.id && blog.name) {
                            uniqueMap.set(`blog-${blog.id}`, blog);
                          }
                        });

                        const suggestions = Array.from(uniqueMap.values())
                          .filter(p => p.name && p.name.toLowerCase().includes(query));


                        if (suggestions.length === 0) return <div className="p-3 text-sm text-gray-500 text-center">No content found. Try typing more characters.</div>;
                        return suggestions.slice(0, 10).map((p, index) => {
                          const isBlog = p.type === 'blog';
                          return (
                            <button key={`${p.id}-${index}`} type="button" className="w-full text-left p-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors" onClick={() => {
                              const el = inputRef.current; const base = newComment || ''; const m = base.match(/@([^\s]*)$/); if (!m) return; const start = base.lastIndexOf('@');
                              // Handle mentions based on type
                              const token = (p.type === 'blog' || p.type === 'guide') ? `@[${p.name}](${p.type}:${p.id})` : `@[${p.name}](listing:${p.id})`;
                              const next = base.slice(0, start) + token + ' ' + base.slice(start + m[0].length);
                              setNewComment(next);
                              setTimeout(() => { try { el?.focus(); el?.setSelectionRange(start + token.length + 1, start + token.length + 1); } catch (_) { } }, 0);
                            }}>
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                  {p.image ? (
                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-gray-500 dark:text-gray-400 text-xs text-center">
                                      {isBlog ? <FaFileAlt className="text-blue-500" size={20} /> : <div className="font-bold text-xl">🏠</div>}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate flex items-center gap-1.5">
                                    {isBlog ? <FaFileAlt className="text-blue-500 flex-shrink-0" size={10} /> : <div className="text-green-500 flex-shrink-0">🏠</div>}
                                    {p.name}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {isBlog ? p.category : (p.city && p.state ? `${p.city}, ${p.state}` : (p.city || p.state || 'Location not available'))}
                                  </div>
                                  {!isBlog && (
                                    <>
                                      {p.price && p.price > 0 ? (
                                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">₹{Number(p.price).toLocaleString()}</div>
                                      ) : (
                                        <div className="text-sm text-gray-400 dark:text-gray-500">Price not available</div>
                                      )}
                                      <div className="text-xs text-gray-400 dark:text-gray-500">
                                        {[p.bedrooms > 0 && `${p.bedrooms}BHK`, p.area > 0 && `${p.area} sq ft`].filter(Boolean).join(' • ') || 'Details not available'}
                                      </div>
                                    </>
                                  )}
                                  {isBlog && (
                                    <div className="text-xs text-gray-400 italic">Blog/Guide Article</div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                  <textarea
                    rows={1}
                    className="w-full pl-4 pr-20 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 dark:text-white resize-none whitespace-pre-wrap break-all hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-xl focus:shadow-2xl transform hover:scale-[1.01] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800"
                    style={{
                      minHeight: '48px',
                      maxHeight: '144px', // 6 lines * 24px line height
                      lineHeight: '24px',
                      wordBreak: 'break-all',
                      overflowWrap: 'break-word'
                    }}
                    placeholder={editingComment ? "Edit your message..." : "Type a message..."}
                    value={newComment}
                    onSelect={(e) => {
                      const start = e.target.selectionStart;
                      const end = e.target.selectionEnd;
                      if (start !== end) {
                        setShowTextStylingPanel(true);
                      }
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewComment(value);
                      if (settings.soundEnabled) playTyping();

                      // Detect URLs in the input
                      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
                      const urls = value.match(urlRegex);
                      if (urls && urls.length > 0) {
                        const newUrl = urls[0];
                        if (newUrl !== lastDismissedUrl) {
                          setDetectedUrl(newUrl);
                          setPreviewDismissed(false); // Reset dismissed flag for new URL
                        }
                      } else {
                        setDetectedUrl(null);
                        setPreviewDismissed(false);
                        setLastDismissedUrl(null);
                      }

                      if (editingComment) {
                        setEditText(value);
                      }

                      // If cleared entirely, restore to original height
                      if ((e.target.value || '').trim() === '') {
                        const textarea = e.target;
                        textarea.style.height = '48px';
                        textarea.style.overflowY = 'hidden';
                        return;
                      }

                      // Auto-expand textarea (WhatsApp style) with scrolling support
                      const textarea = e.target;
                      textarea.style.height = '48px'; // Reset to min height
                      const scrollHeight = textarea.scrollHeight;
                      const maxHeight = 144; // 6 lines max

                      if (scrollHeight <= maxHeight) {
                        // If content fits within max height, expand the textarea
                        textarea.style.height = scrollHeight + 'px';
                        textarea.style.overflowY = 'hidden';
                      } else {
                        // If content exceeds max height, set to max height and enable scrolling
                        textarea.style.height = maxHeight + 'px';
                        textarea.style.overflowY = 'auto';
                      }
                    }}
                    onClick={() => {
                      if (headerOptionsMessageId) {
                        setHeaderOptionsMessageId(null);
                        toast.info("You can hit reply icon in header to reply");
                      }
                    }}
                    onScroll={(e) => {
                      // Prevent scroll event from propagating to parent chat container
                      e.stopPropagation();
                    }}
                    onPaste={(e) => {
                      const items = Array.from(e.clipboardData.items);
                      // Find the first item that is a file
                      const fileItem = items.find(item => item.kind === 'file');

                      if (fileItem) {
                        e.preventDefault();
                        const file = fileItem.getAsFile();

                        if (file) {
                          if (file.type.startsWith('image/')) {
                            handleImageFiles([file]);
                          } else if (file.type.startsWith('video/')) {
                            if (file.size > 100 * 1024 * 1024) {
                              toast.error('Maximum video size is 100MB');
                            } else {
                              setSelectedVideo(file);
                              setShowVideoPreviewModal(true);
                            }
                          } else if (file.type.startsWith('audio/')) {
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error('Maximum audio size is 10MB');
                            } else {
                              setSelectedAudio(file);
                              setShowAudioPreviewModal(true);
                            }
                          } else {
                            // Treat as document
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error('Maximum document size is 10MB');
                            } else {
                              setSelectedDocument(file);
                              setShowDocumentPreviewModal(true);
                            }
                          }
                        }
                      }
                    }}
                    onKeyDown={e => {
                      // Check if this is a desktop viewport only
                      const isDesktop = window.matchMedia('(min-width: 768px)').matches;

                      if (e.key === 'Enter') {
                        // Avoid sending while composing (IME)
                        if (e.isComposing || e.keyCode === 229) return;
                        // For desktop: Enter sends message, Shift+Enter creates new line
                        if (isDesktop && !e.shiftKey) {
                          e.preventDefault();
                          if (editingComment) {
                            handleEditComment(editingComment);
                          } else {
                            handleCommentSend();
                          }
                        }
                        // For mobile or with Shift+Enter: allow new line (default behavior)
                        // Ctrl+Enter or Cmd+Enter still works on all devices
                        else if ((e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          if (editingComment) {
                            handleEditComment(editingComment);
                          } else {
                            handleCommentSend();
                          }
                        }
                      }
                    }}
                    ref={inputRef}
                  />
                  {/* Emoji Button - Inside textarea on the right */}
                  <div className="absolute right-12 bottom-2">
                    <EmojiButton
                      onEmojiClick={(emoji) => {
                        // Use live input value and caret selection for robust insertion
                        const el = inputRef?.current;
                        const baseText = el ? el.value : newComment;
                        let start = baseText.length;
                        let end = baseText.length;
                        try {
                          if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
                            start = el.selectionStart;
                            end = el.selectionEnd;
                          }
                        } catch (_) { }
                        const newText = baseText.slice(0, start) + emoji + baseText.slice(end);
                        setNewComment(newText);
                        if (editingComment) {
                          setEditText(newText);
                        }
                        // Restore caret after inserted emoji just after the emoji
                        setTimeout(() => {
                          try {
                            if (el) {
                              const caretPos = start + emoji.length;
                              el.focus();
                              el.setSelectionRange(caretPos, caretPos);
                            }
                          } catch (_) { }
                        }, 0);
                      }}
                      className="w-8 h-8"
                      inputRef={inputRef}
                    />
                  </div>
                  {/* Attachment Button with panel */}
                  <div className="absolute right-3 bottom-3">
                    <button
                      ref={attachmentButtonRef}
                      type="button"
                      onClick={() => setShowAttachmentPanel(prev => !prev)}
                      disabled={uploadingFile}
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${uploadingFile
                        ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-md active:scale-95'
                        }`}
                      title="Attach"
                    >
                      {uploadingFile ? (
                        <UrbanSetuSpinner size="sm" />
                      ) : (
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                    </button>
                    {showAttachmentPanel && !uploadingFile && (
                      <div ref={attachmentPanelRef} className="absolute bottom-10 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg w-48 py-2 z-20">
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Photos
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handleFileUpload(files);
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        {/* Camera - Simple file input approach */}
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h2l1-2h6l1 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                          Camera
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload([e.target.files[0]]);
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Videos
                          <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                if (file.size > 100 * 1024 * 1024) {
                                  toast.error('Maximum video size is 100MB');
                                } else {
                                  setSelectedVideo(file);
                                  setShowVideoPreviewModal(true);
                                }
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Documents
                          <input
                            ref={documentInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) {
                                  toast.error('Maximum document size is 10MB');
                                } else {
                                  setSelectedDocument(file);
                                  setShowDocumentPreviewModal(true);
                                }
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        {/* Audio */}
                        <label className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v8a3 3 0 106 0V4a3 3 0 00-3-3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 11-14 0v-2" />
                          </svg>
                          Audio
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files && e.target.files[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) {
                                  toast.error('Maximum audio size is 10MB');
                                } else {
                                  setSelectedAudio(file);
                                  setShowAudioPreviewModal(true);
                                }
                              }
                              e.target.value = '';
                              setShowAttachmentPanel(false);
                            }}
                          />
                        </label>
                        {/* Record Audio */}
                        <button
                          type="button"
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer w-full text-left"
                          onClick={() => {
                            setShowAttachmentPanel(false);
                            setShowRecordAudioModal(true);
                          }}
                        >
                          <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v8a3 3 0 106 0V4a3 3 0 00-3-3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 11-14 0v-2" />
                          </svg>
                          Record Audio
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (editingComment) {
                      handleEditComment(editingComment);
                    } else {
                      handleCommentSend();
                    }
                  }}
                  disabled={editingComment ? savingComment === editingComment : !newComment.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-700 text-white w-12 h-12 rounded-full shadow-lg hover:from-blue-700 hover:to-purple-800 hover:shadow-xl transform hover:scale-110 transition-all duration-300 disabled:opacity-50 disabled:transform-none flex items-center justify-center hover:shadow-2xl active:scale-95 group"
                >
                  {editingComment ? (
                    savingComment === editingComment ? (
                      <FaPen className="text-lg text-white animate-editSaving" />
                    ) : (
                      <FaPen className="text-lg text-white group-hover:scale-110 transition-transform duration-200" />
                    )
                  ) : (
                    <div className="relative">
                      {sendIconSent ? (
                        <FaCheck className="text-lg text-white group-hover:scale-110 transition-all duration-300 send-icon animate-sent" />
                      ) : (
                        <FaPaperPlane className={`text-lg text-white group-hover:scale-110 transition-all duration-300 send-icon ${sendIconAnimating ? 'animate-fly' : ''}`} />
                      )}
                    </div>
                  )}
                </button>
              </div>

              {/* File Upload Error */}
              {fileUploadError && (
                <div className="px-3 pb-2">
                  <div className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-200 dark:border-red-900/50">
                    {fileUploadError}
                  </div>
                </div>
              )}

              {/* Multi-Image Preview Modal - Positioned as overlay */}
              {showImagePreviewModal && selectedFiles.length > 0 && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-medium text-gray-700 dark:text-white">
                        Image Preview ({selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''})
                      </span>
                      <button
                        onClick={() => {
                          setSelectedFiles([]);
                          setImageCaptions({});
                          setPreviewIndex(0);
                          setShowImagePreviewModal(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                      >
                        <FaTimes className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Image Slideshow */}
                    <div className="relative mb-4">
                      {/* Navigation Arrows */}
                      {selectedFiles.length > 1 && (
                        <>
                          <button
                            onClick={() => setPreviewIndex(prev => prev > 0 ? prev - 1 : selectedFiles.length - 1)}
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setPreviewIndex(prev => prev < selectedFiles.length - 1 ? prev + 1 : 0)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}

                      {/* Current Image */}
                      <div className="mb-3 text-center">
                        <img
                          src={URL.createObjectURL(selectedFiles[previewIndex])}
                          alt={`Preview ${previewIndex + 1}`}
                          className="w-full h-64 object-contain rounded-lg border dark:border-gray-700"
                        />
                      </div>

                      {/* Image Counter */}
                      <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {previewIndex + 1} of {selectedFiles.length}
                      </div>

                      {/* Image Thumbnails */}
                      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 pb-2 min-w-0 max-w-full" style={{ scrollbarWidth: 'thin', scrollbarColor: isDarkMode ? '#4b5563 #1f2937' : '#d1d5db #f3f4f6' }}>
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="relative">
                            <button
                              onClick={() => setPreviewIndex(index)}
                              className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 transition-all duration-200 ${index === previewIndex
                                ? 'border-blue-500 shadow-lg'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                }`}
                            >
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            </button>
                            {/* Delete Icon on Thumbnail - Only show when multiple images are selected */}
                            {selectedFiles.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent triggering the thumbnail selection
                                  const newFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
                                  const newCaptions = { ...imageCaptions };
                                  // Remove caption for deleted image
                                  delete newCaptions[file.name];

                                  if (newFiles.length === 0) {
                                    // If no images left, close modal
                                    setSelectedFiles([]);
                                    setImageCaptions({});
                                    setShowImagePreviewModal(false);
                                  } else {
                                    // Update files and adjust preview index
                                    setSelectedFiles(newFiles);
                                    setImageCaptions(newCaptions);
                                    // Adjust preview index if needed
                                    if (previewIndex >= newFiles.length) {
                                      setPreviewIndex(newFiles.length - 1);
                                    } else if (previewIndex > index) {
                                      // If we deleted an image before the current preview, adjust index
                                      setPreviewIndex(previewIndex - 1);
                                    }
                                  }
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-all duration-200 hover:scale-110 z-10"
                                title="Remove this image"
                                aria-label="Remove this image"
                              >
                                <FaTimes className="w-2 h-2" />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Add More Images Button - Only show when less than 10 images */}
                        {selectedFiles.length < 10 && (
                          <div className="relative">
                            <label className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 cursor-pointer flex items-center justify-center group">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = e.target.files;
                                  if (files && files.length > 0) {
                                    // Calculate how many more images can be added
                                    const remainingSlots = 10 - selectedFiles.length;
                                    const filesToAdd = Array.from(files).slice(0, remainingSlots);

                                    if (filesToAdd.length > 0) {
                                      // Add new files to existing selection
                                      const newFiles = [...selectedFiles, ...filesToAdd];
                                      setSelectedFiles(newFiles);

                                      // Show notification if some files were skipped
                                      if (filesToAdd.length < files.length) {
                                        toast.info(`Added ${filesToAdd.length} images. Maximum limit of 10 images reached.`);
                                      }
                                    }
                                    // Reset the input
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Caption for Current Image */}
                    <div className="relative mb-4">
                      <textarea
                        placeholder={`Add a caption for ${selectedFiles[previewIndex]?.name}...`}
                        value={imageCaptions[selectedFiles[previewIndex]?.name] || ''}
                        onChange={(e) => setImageCaptions(prev => ({
                          ...prev,
                          [selectedFiles[previewIndex]?.name]: e.target.value
                        }))}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        maxLength={500}
                      />
                      {/* Emoji Picker for Caption */}
                      <div className="absolute right-2 top-2">
                        <EmojiButton
                          onEmojiClick={(emoji) => {
                            const currentCaption = imageCaptions[selectedFiles[previewIndex]?.name] || '';
                            setImageCaptions(prev => ({
                              ...prev,
                              [selectedFiles[previewIndex]?.name]: currentCaption + emoji
                            }));
                          }}
                          className="w-6 h-6"
                        />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                        {(imageCaptions[selectedFiles[previewIndex]?.name] || '').length}/500
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {uploadingFile && currentFileIndex >= 0 ? (
                          <span>
                            Uploading {currentFileIndex + 1} / {selectedFiles.length}
                            {` • ${currentFileProgress}%`}
                          </span>
                        ) : (
                          <>
                            {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''} ready to send
                            {failedFiles.length > 0 && (
                              <span className="ml-2 text-red-600 dark:text-red-400">• {failedFiles.length} failed</span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadingFile ? (
                          <>
                            <button
                              onClick={handleCancelInFlightUpload}
                              className="bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                            >
                              Cancel Upload
                            </button>
                            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 w-10 text-right">{uploadProgress}%</span>
                          </>
                        ) : (
                          <>
                            {failedFiles.length > 0 && (
                              <button
                                onClick={handleRetryFailedUploads}
                                className="bg-yellow-500 text-white py-2 px-3 rounded-lg hover:bg-yellow-600 text-sm font-medium transition-colors"
                              >
                                Retry Failed ({failedFiles.length})
                              </button>
                            )}
                            <button
                              onClick={handleSendImagesWithCaptions}
                              className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                            >
                              {`Send ${selectedFiles.length} Image${selectedFiles.length !== 1 ? 's' : ''}`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Animations for chat bubbles */}
              <style jsx>{`
                @keyframes fadeInChatBubble {
                  from { opacity: 0; transform: translateY(20px) scale(0.95); }
                  to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fadeInChatBubble {
                  animation: fadeInChatBubble 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                }
                @keyframes fadeInChat {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeInChat {
                  animation: fadeInChat 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                }
                @keyframes gentlePulse {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.9; transform: scale(1.01); }
                }
                .animate-gentlePulse {
                  animation: gentlePulse 3s ease-in-out infinite;
                }
                @keyframes attentionGlow {
                  0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
                  50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }
                }
                .animate-attentionGlow {
                  animation: attentionGlow 2s ease-in-out infinite;
                }
                @keyframes slideInFromTop {
                  from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                  to { opacity: 1; transform: translateY(0) scale(1); }
                }
                                  .animate-slideInFromTop {
                    animation: slideInFromTop 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                  }
                  @keyframes sendIconFly {
                    0% { 
                      transform: translate(0, 0) scale(1); 
                      opacity: 1;
                    }
                    20% { 
                      transform: translate(0, 0) scale(1.2); 
                      opacity: 1;
                    }
                    40% { 
                      transform: translate(15px, -20px) scale(1.3); 
                      opacity: 0.8;
                    }
                    60% { 
                      transform: translate(25px, -35px) scale(1.4); 
                      opacity: 0.6;
                    }
                    80% { 
                      transform: translate(15px, -20px) scale(1.2); 
                      opacity: 0.8;
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
                  @keyframes editSaving {
                    0% { 
                      transform: scale(1) rotate(0deg) translate(0, 0); 
                      opacity: 1;
                    }
                    20% { 
                      transform: scale(1.15) rotate(-8deg) translate(-1px, -1px); 
                      opacity: 0.9;
                    }
                    40% { 
                      transform: scale(1.25) rotate(0deg) translate(0, -2px); 
                      opacity: 1;
                    }
                    60% { 
                      transform: scale(1.15) rotate(8deg) translate(1px, -1px); 
                      opacity: 0.9;
                    }
                    80% { 
                      transform: scale(1.1) rotate(-4deg) translate(-1px, 0); 
                      opacity: 0.95;
                    }
                    100% { 
                      transform: scale(1) rotate(0deg) translate(0, 0); 
                      opacity: 1;
                    }
                  }
                  .animate-editSaving {
                    animation: editSaving 1.2s ease-in-out infinite;
                  }
                  .search-highlight {
                    animation: searchHighlight 2s ease-in-out;
                  }
                  @keyframes searchHighlight {
                    0%, 100% { box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
                    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
                  }
                  .date-highlight {
                    animation: dateHighlight 3s ease-in-out;
                  }
                  @keyframes dateHighlight {
                    0%, 100% { box-shadow: 0 0 0 rgba(168, 85, 247, 0); }
                    50% { box-shadow: 0 0 25px rgba(168, 85, 247, 0.9); }
                  }
                `}</style>

              {/* Floating Scroll to bottom button - WhatsApp style */}
              {!isAtBottom && !editingComment && !replyTo && (
                <div className="absolute bottom-20 right-6 z-20">
                  <button
                    onClick={() => {
                      setVisibleCount(Math.max(MESSAGES_PAGE_SIZE, localComments.length));
                      setTimeout(() => scrollToBottom(), 50); // Small delay to ensure DOM updates
                    }}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-3 shadow-xl transition-all duration-200 hover:scale-110 relative transform hover:shadow-2xl"
                    title={unreadNewMessages > 0 ? `${unreadNewMessages} new message${unreadNewMessages > 1 ? 's' : ''} - Scroll to bottom` : "Scroll to bottom"}
                    aria-label={unreadNewMessages > 0 ? `${unreadNewMessages} new messages, scroll to bottom` : "Scroll to bottom"}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="transform"
                    >
                      <path d="M12 16l-6-6h12l-6 6z" />
                    </svg>
                    {unreadNewMessages > 0 && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 border-2 border-white shadow-lg">
                        {unreadNewMessages > 99 ? '99+' : unreadNewMessages}
                      </div>
                    )}
                  </button>
                </div>
              )}
              {/* Delete Chat Confirmation Modal (overlay above chat) */}
              {showDeleteChatModal && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl p-6 w-full max-w-sm relative shadow-2xl">
                    <button
                      className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full p-2 transition-colors"
                      onClick={() => { setShowDeleteChatModal(false); setDeleteChatPassword(''); }}
                      title="Close"
                      aria-label="Close"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                    <h3 className="text-lg font-bold mb-4 text-red-600 flex items-center gap-2">
                      <FaTrash /> Delete Entire Chat
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">This will permanently delete all messages for this appointment, removing them from the user's side as well. Enter admin password to confirm.</p>
                    <input
                      type="password"
                      className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 w-full focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 mb-4"
                      placeholder="Admin password"
                      value={deleteChatPassword}
                      onChange={e => setDeleteChatPassword(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && deleteChatPassword.trim() && !deleteChatLoading) {
                          e.preventDefault();
                          // Execute delete chat functionality
                          handleDeleteChat();
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => { setShowDeleteChatModal(false); setDeleteChatPassword(''); }}
                        className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deleteChatLoading || !deleteChatPassword}
                        onClick={handleDeleteChat}
                        className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                      >
                        {deleteChatLoading ? 'Deleting...' : (
                          <>
                            <FaTrash size={12} /> Delete Chat
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Preview Modal */}
        {showAudioPreviewModal && selectedAudio && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-medium text-gray-700 dark:text-white">Audio Preview</span>
                <button
                  onClick={() => { setSelectedAudio(null); setShowAudioPreviewModal(false); }}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <audio controls className="w-full" src={audioObjectURL} />
              </div>
              <div className="relative mb-4">
                <div className="relative">
                  <textarea
                    ref={audioCaptionRef}
                    placeholder={`Add a caption for ${selectedAudio.name}...`}
                    value={audioCaption}
                    onChange={(e) => setAudioCaption(e.target.value)}
                    className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="absolute right-2 top-2">
                    <EmojiButton
                      onEmojiClick={(emoji) => {
                        const textarea = audioCaptionRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newValue = audioCaption.slice(0, start) + emoji + audioCaption.slice(end);
                          setAudioCaption(newValue);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                          }, 0);
                        }
                      }}
                      inputRef={audioCaptionRef}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {audioCaption.length}/500
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-4">{selectedAudio.name}</div>
                <div className="flex items-center gap-2">
                  {uploadingFile ? (
                    <>
                      <button
                        onClick={handleCancelInFlightUpload}
                        className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Cancel
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 w-10 text-right">{uploadProgress}%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setSelectedAudio(null); setShowAudioPreviewModal(false); }}
                        className="py-2 px-4 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >Cancel</button>
                      <button
                        onClick={handleSendSelectedAudio}
                        disabled={isChatSendBlocked}
                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${isChatSendBlocked ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                      >Send Audio</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Message Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaTrash className="text-red-600 dark:text-red-400 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                      {messageToDelete?.isCall || (messageToDelete?._id && messageToDelete._id.startsWith('call-')) ? 'Delete Call' : 'Delete Message'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
                      {messageToDelete?.isCall || (messageToDelete?._id && messageToDelete._id.startsWith('call-'))
                        ? 'Are you sure you want to delete this call from the chat? The call will be removed from your view, but the call record will remain in the database.'
                        : 'Are you sure you want to delete this message for everyone?'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    disabled={deleteMessageLoading}
                    onClick={() => {
                      setShowDeleteModal(false);
                      setMessageToDelete(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteMessageLoading}
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteMessageLoading ? (
                      <>
                        <UrbanSetuSpinner size="sm" isBright={true} />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <FaTrash size={14} />
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Appointment Modal */}
        {showCancelModal && appointmentToHandle === appt._id && (
          <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaBan className="text-red-600 dark:text-red-400 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Cancel Appointment</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-justify mb-4">
                      Are you sure you want to cancel this appointment?
                    </p>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reason for cancellation (required):
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        rows="3"
                        placeholder="Please provide a reason for cancelling this appointment..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelModal(false);
                      setAppointmentToHandle(null);
                      setCancelReason('');
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmAdminCancel}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <FaBan size={14} />
                    Cancel Appointment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reinitiate Appointment Modal */}
        {showReinitiateModal && appointmentToHandle === appt._id && (() => {
          const isRefunded = reinitiatePaymentStatus && (reinitiatePaymentStatus.status === 'refunded' || reinitiatePaymentStatus.status === 'partially_refunded');
          const isCancelled = appt.status === 'cancelledByBuyer' || appt.status === 'cancelledBySeller' || appt.status === 'cancelledByAdmin';
          const showRefundWarning = isCancelled && isRefunded;

          // Get reinitiation counts
          const buyerReinitiationCount = appt.buyerReinitiationCount || 0;
          const sellerReinitiationCount = appt.sellerReinitiationCount || 0;
          const maxReinitiations = 2;

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaUndo className="text-green-600 dark:text-green-400 text-xl" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Reinitiate Appointment</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full font-medium">
                          Buyer: {buyerReinitiationCount}/{maxReinitiations} • Seller: {sellerReinitiationCount}/{maxReinitiations}
                        </span>
                      </div>
                      {showRefundWarning ? (
                        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-3">
                          <p className="text-sm font-semibold mb-1">Reinitiation Disabled</p>
                          <p className="text-sm">The buyer has already received a refund for this appointment.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-justify mb-3">
                            Are you sure you want to reinitiate this appointment? This will notify both buyer and seller.
                          </p>
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-4 py-2 rounded-lg mb-3">
                            <p className="text-xs font-semibold mb-1">Reinitiation Count:</p>
                            <p className="text-xs">Buyer: {buyerReinitiationCount}/{maxReinitiations} used • Seller: {sellerReinitiationCount}/{maxReinitiations} used</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReinitiateModal(false);
                        setAppointmentToHandle(null);
                        setReinitiatePaymentStatus(null);
                      }}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmReinitiate}
                      disabled={showRefundWarning}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${showRefundWarning
                        ? 'bg-gray-400 dark:bg-gray-700 text-gray-600 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                    >
                      <FaUndo size={14} />
                      Reinitiate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Archive Appointment Modal */}
        {showArchiveModal && appointmentToHandle === appt._id && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaArchive className="text-blue-600 dark:text-blue-400 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Archive Appointment</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
                      Are you sure you want to archive this appointment? It will be moved to the archived section.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchiveModal(false);
                      setAppointmentToHandle(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmArchive}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FaArchive size={14} />
                    Archive
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unarchive Appointment Modal */}
        {showUnarchiveModal && appointmentToHandle === appt._id && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-fadeIn">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaUndo className="text-green-600 dark:text-green-400 text-xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Unarchive Appointment</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-justify">
                      Are you sure you want to unarchive this appointment? It will be moved back to the active appointments.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnarchiveModal(false);
                      setAppointmentToHandle(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmUnarchive}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <FaUndo size={14} />
                    Unarchive
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Starred Messages Modal */}
        {showStarredModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaStar className="text-yellow-500" />
                  Starred Messages
                </h3>
                <button
                  onClick={fetchStarredMessages}
                  disabled={loadingStarredMessages}
                  className="p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/60 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh starred messages"
                >
                  {loadingStarredMessages ? (
                    <UrbanSetuSpinner size="sm" />
                  ) : (
                    <FaSync className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingStarredMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <UrbanSetuSpinner size="md" />
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading starred messages...</span>
                  </div>
                ) : starredMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <FaRegStar className="mx-auto text-6xl text-gray-300 dark:text-gray-600 mb-4" />
                    <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Starred Messages</h4>
                    <p className="text-gray-500 dark:text-gray-500">Star important messages to find them easily later.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {starredMessages.map((message, index) => {
                      const isMe = message.senderEmail === currentUser.email;
                      const messageDate = new Date(message.timestamp);

                      return (
                        <div key={message._id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
                          <div className={`relative max-w-[80%] ${isMe ? 'ml-12' : 'mr-12'}`}>
                            {/* Star indicator and remove button */}
                            <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <FaStar className="text-yellow-500 text-xs" />
                              <span className={`text-xs font-medium ${isMe ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                                {isMe ? 'You' : (() => {
                                  // Find the sender name based on senderEmail
                                  if (message.senderEmail === appt.buyerId?.email) {
                                    return appt.buyerId?.username || 'Buyer';
                                  } else if (message.senderEmail === appt.sellerId?.email) {
                                    return appt.sellerId?.username || 'Seller';
                                  } else {
                                    // For admin messages or other cases
                                    return message.senderName || 'UrbanSetu';
                                  }
                                })()}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {messageDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                              {/* Remove star button */}
                              <button
                                onClick={async () => {
                                  setUnstarringMessageId(message._id);
                                  try {
                                    const res = await authenticatedFetch(`${API_BASE_URL}/api/bookings/${appt._id}/comment/${message._id}/star`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ starred: false })
                                    });
                                    if (!res.ok) throw new Error('Failed to unstar message');
                                    const data = await res.json();
                                    // Remove from starred messages list
                                    setStarredMessages(prev => prev.filter(m => m._id !== message._id));
                                    // Update the main comments state
                                    setLocalComments(prev => {
                                      const updated = prev.map(c =>
                                        c._id === message._id
                                          ? { ...c, starredBy: (c.starredBy || []).filter(id => id !== currentUser._id) }
                                          : c
                                      );

                                      // Update appointment comments for parent component with the updated state
                                      updateAppointmentComments(appt._id, updated);

                                      return updated;
                                    });
                                    toast.success('Message unstarred');
                                  } catch (err) {
                                    toast.error('Failed to unstar message');
                                  } finally {
                                    setUnstarringMessageId(null);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 text-xs p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="Remove from starred messages"
                                disabled={unstarringMessageId === message._id}
                              >
                                {unstarringMessageId === message._id ? (
                                  <UrbanSetuSpinner size="sm" />
                                ) : (
                                  <FaTimes className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Message bubble - styled like chatbox */}
                            <div
                              className={`rounded-2xl px-4 py-3 text-sm shadow-lg break-words relative group cursor-pointer hover:shadow-xl transition-all duration-200 ${isMe
                                ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white hover:from-blue-500 hover:to-purple-600 dark:from-blue-700 dark:to-purple-800'
                                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-650 hover:border-gray-300 dark:hover:border-gray-500'
                                }`}
                              onClick={() => {
                                setShowStarredModal(false);
                                // Scroll to the message in the main chat if it exists
                                const messageElement = document.querySelector(`[data-message-id="${message._id}"]`);
                                if (messageElement) {
                                  messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  messageElement.classList.add('starred-highlight');
                                  setTimeout(() => {
                                    messageElement.classList.remove('starred-highlight');
                                  }, 1600);
                                }
                              }}
                            >
                              {/* Removed in-message corner flag; now shown near three-dots in live chat */}
                              <div className="whitespace-pre-wrap break-words">
                                {/* Image Message - Always show if exists, even for deleted messages */}
                                {(message.originalImageUrl || message.imageUrl) && (
                                  <div className="mb-2">
                                    <img
                                      src={message.originalImageUrl || message.imageUrl}
                                      alt="Shared image"
                                      className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const chatImages = (localComments || []).filter(msg => !!(msg.originalImageUrl || msg.imageUrl)).map(msg => msg.originalImageUrl || msg.imageUrl);
                                        const currentUrl = message.originalImageUrl || message.imageUrl;
                                        const startIndex = Math.max(0, chatImages.indexOf(currentUrl));
                                        setPreviewImages(chatImages);
                                        setPreviewIndex(startIndex);
                                        setShowImagePreview(true);
                                      }}
                                      onError={(e) => {
                                        e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                        e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                      }}
                                    />
                                  </div>
                                )}
                                {/* Video Message */}
                                {message.videoUrl && (
                                  <div className="mb-2 relative group max-w-full inline-block">
                                    <div
                                      className="relative rounded-lg overflow-hidden bg-black cursor-pointer shadow-md hover:shadow-lg transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const videoUrls = (localComments || []).filter(msg => !!msg.videoUrl && !msg.deleted).map(msg => msg.videoUrl);
                                        const startIndex = Math.max(0, videoUrls.indexOf(message.videoUrl));
                                        window.dispatchEvent(new CustomEvent('open-media-preview', {
                                          detail: {
                                            videos: videoUrls,
                                            index: startIndex
                                          }
                                        }));
                                      }}
                                    >
                                      {/* Use video tag as thumbnail, no controls */}
                                      <video
                                        src={message.videoUrl}
                                        className="max-w-full max-h-64 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                                        preload="metadata"
                                      />
                                      {/* Play Overlay */}
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                        <div className="bg-black/60 rounded-full p-3 backdrop-blur-sm transform group-hover:scale-110 transition-transform">
                                          <FaPlay className="text-white text-xl ml-1" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Document Message */}
                                {message.documentUrl && (
                                  <div className="mb-2">
                                    <button
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const a = document.createElement('a');
                                        a.href = message.documentUrl;
                                        a.download = message.documentName || `document-${message._id || Date.now()}`;
                                        a.target = '_blank';
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                      }}
                                    >
                                      <span className="text-2xl">📄</span>
                                      <span className="text-sm text-blue-700 dark:text-blue-400 truncate max-w-[200px]">{message.documentName || 'Document'}</span>
                                    </button>
                                  </div>
                                )}

                                {/* Message content - Show preserved content for deleted messages */}
                                {message.deleted ? (
                                  <div className="border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded p-2 mb-2">
                                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold mb-1">
                                      <FaBan className="inline-block" />
                                      Message deleted by {message.deletedBy || 'user'} (Admin view - preserved for records)
                                    </div>

                                    {/* Show preserved image if exists */}
                                    {(message.originalImageUrl || message.imageUrl) && (
                                      <div className="mb-2">
                                        <img
                                          src={message.originalImageUrl || message.imageUrl}
                                          alt="Preserved image from deleted message"
                                          className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const chatImages = (localComments || []).filter(msg => !!(msg.originalImageUrl || msg.imageUrl)).map(msg => msg.originalImageUrl || msg.imageUrl);
                                            const currentUrl = message.originalImageUrl || message.imageUrl;
                                            const startIndex = Math.max(0, chatImages.indexOf(currentUrl));
                                            setPreviewImages(chatImages);
                                            setPreviewIndex(startIndex);
                                            setShowImagePreview(true);
                                          }}
                                          onError={(e) => {
                                            e.target.src = "https://via.placeholder.com/300x200?text=Image+Not+Found";
                                            e.target.className = "max-w-full max-h-64 rounded-lg opacity-50";
                                          }}
                                        />
                                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 italic">
                                          Preserved image from deleted message
                                        </div>
                                      </div>
                                    )}

                                    {/* Show preserved video if exists */}
                                    {message.videoUrl && (
                                      <div className="mb-2">
                                        <div
                                          className="relative rounded-lg overflow-hidden bg-black cursor-pointer shadow-md hover:shadow-lg transition-all"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Handle preserved videos - include them in preview
                                            const videoUrls = (localComments || []).filter(msg => !!msg.videoUrl).map(msg => msg.videoUrl);
                                            const startIndex = Math.max(0, videoUrls.indexOf(message.videoUrl));
                                            window.dispatchEvent(new CustomEvent('open-media-preview', {
                                              detail: {
                                                videos: videoUrls,
                                                index: startIndex
                                              }
                                            }));
                                          }}
                                        >
                                          {/* Use video tag as thumbnail, no controls */}
                                          <video
                                            src={message.videoUrl}
                                            className="max-w-full max-h-64 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                                            preload="metadata"
                                          />
                                          {/* Play Overlay */}
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                            <div className="bg-black/60 rounded-full p-3 backdrop-blur-sm transform group-hover:scale-110 transition-transform">
                                              <FaPlay className="text-white text-xl ml-1" />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 italic">
                                          Preserved video from deleted message
                                        </div>
                                      </div>
                                    )}

                                    {/* Show preserved audio if exists */}
                                    {message.audioUrl && (
                                      <div className="mb-2">
                                        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                                          <audio
                                            src={message.audioUrl}
                                            className="w-full"
                                            controls
                                            preload="metadata"
                                          />
                                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 italic">
                                            Preserved audio from deleted message: {message.audioName || 'Audio file'}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Show preserved document if exists */}
                                    {message.documentUrl && (
                                      <div className="mb-2">
                                        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">📄</span>
                                            <div className="flex-1">
                                              <div className="text-sm font-medium text-gray-800 dark:text-white">
                                                {message.documentName || 'Document'}
                                              </div>
                                              <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                                                Preserved document from deleted message
                                              </div>
                                            </div>
                                            <button
                                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  const response = await authenticatedFetch(message.documentUrl, { mode: 'cors' });
                                                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                                  const blob = await response.blob();
                                                  const blobUrl = window.URL.createObjectURL(blob);
                                                  const a = document.createElement('a');
                                                  a.href = blobUrl;
                                                  a.download = message.documentName || `document-${message._id || Date.now()}`;
                                                  document.body.appendChild(a);
                                                  a.click();
                                                  a.remove();
                                                  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
                                                  toast.success('Document downloaded successfully');
                                                } catch (error) {
                                                  const a = document.createElement('a');
                                                  a.href = message.documentUrl;
                                                  a.download = message.documentName || `document-${message._id || Date.now()}`;
                                                  a.target = '_blank';
                                                  document.body.appendChild(a);
                                                  a.click();
                                                  a.remove();
                                                  toast.success('Document download started');
                                                }
                                              }}
                                            >
                                              Download
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div className="text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border-l-4 border-red-400 dark:border-red-600 relative group">
                                      {(() => {
                                        const messageContent = message.originalMessage || message.message;
                                        if (messageContent) {
                                          return (
                                            <>
                                              <span className="whitespace-pre-wrap break-words">{messageContent}</span>
                                              {/* Copy icon - visible on hover */}
                                              <button
                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-700 rounded p-1 shadow-sm"
                                                onClick={(e) => { e.stopPropagation(); copyMessageToClipboard(messageContent); }}
                                                title="Copy deleted message content"
                                                aria-label="Copy deleted message content"
                                              >
                                                <FaCopy className="w-3 h-3" />
                                              </button>
                                            </>
                                          );
                                        } else {
                                          return (
                                            <span className="text-gray-500 italic">
                                              [Message content not preserved - this message was deleted before content preservation was implemented]
                                            </span>
                                          );
                                        }
                                      })()}
                                    </div>
                                  </div>
                                ) : (
                                  <FormattedTextWithReadMore
                                    text={(message.message || '').replace(/\n+$/, '')}
                                    isSentMessage={isMe}
                                    className="whitespace-pre-wrap break-words"
                                    searchQuery={searchQuery}
                                  />
                                )}
                              </div>

                              {/* Copy button - appears on hover for non-deleted messages */}
                              {!message.deleted && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyMessageToClipboard(message.message); }}
                                  className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-full ${isMe
                                    ? 'bg-white/20 hover:bg-white/30 text-white'
                                    : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300'
                                    }`}
                                  title="Copy message"
                                >
                                  <FaCopy className="w-3 h-3" />
                                </button>
                              )}

                              {/* Edited indicator only (no time display) */}
                              {message.edited && (
                                <div className={`flex justify-end mt-2 text-xs ${isMe ? 'text-blue-200 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                                  }`}>
                                  <span className="italic">(Edited)</span>
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

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {starredMessages.length} starred message{starredMessages.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-2">
                    {starredMessages.length > 0 && (
                      <button
                        onClick={handleRemoveAllStarredMessages}
                        disabled={removingAllStarred}
                        className="px-2 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                      >
                        {removingAllStarred ? (
                          <>
                            <UrbanSetuSpinner size="sm" isBright={true} />
                            Removing...
                          </>
                        ) : (
                          <>
                            <FaTrash className="w-4 h-4" />
                            Remove All
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setShowStarredModal(false)}
                      className="px-2 sm:px-4 py-1.5 sm:py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium text-xs sm:text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Appointment-scoped Reports Modal (styled like Starred Messages) */}
        {showReportsModal && createPortal((
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 flex-shrink-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FaFlag className="text-red-500" /> Appointment Reports
                </h3>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="flex items-center bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 rounded-lg overflow-hidden mr-1 sm:mr-2">
                    <button
                      className={`px-2 sm:px-3 py-1.5 text-xs font-medium ${reportsFilter === 'message' ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                      onClick={() => setReportsFilter('message')}
                    >
                      Message Reports
                    </button>
                    <button
                      className={`px-2 sm:px-3 py-1.5 text-xs font-medium border-l border-red-200 dark:border-red-800 ${reportsFilter === 'chat' ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                      onClick={() => setReportsFilter('chat')}
                    >
                      Chat Reports
                    </button>
                  </div>
                  <button
                    onClick={() => fetchAllReports(appt._id, reportsFilters, true)}
                    disabled={reportsLoading}
                    className="p-2 text-red-600 hover:text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-300 dark:hover:text-red-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh reports"
                  >
                    {reportsLoading ? (
                      <UrbanSetuSpinner size="sm" />
                    ) : (
                      <FaSync className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowReportsModal(false)}
                    className="px-2 sm:px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-xs sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Filters Section - Mobile Optimized */}
              <div className="p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 sticky top-0 z-10">
                <div className="space-y-3">
                  {/* Primary filters - compact on mobile */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                      <input
                        type="date"
                        value={reportsFilters.dateFrom}
                        onChange={(e) => setReportsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
                      <input
                        type="date"
                        value={reportsFilters.dateTo}
                        onChange={(e) => setReportsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Reporter</label>
                      <input
                        type="text"
                        placeholder="Reporter"
                        value={reportsFilters.reporter}
                        onChange={(e) => setReportsFilters(prev => ({ ...prev, reporter: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                      <select
                        value={reportsFilters.messageType}
                        onChange={(e) => setReportsFilters(prev => ({ ...prev, messageType: e.target.value }))}
                        className="w-full p-1.5 sm:p-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="all">All Types</option>
                        <option value="text">Text</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="document">Document</option>
                      </select>
                    </div>
                  </div>

                  {/* Secondary controls - compact on mobile */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center justify-between">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={reportsFilters.search}
                        onChange={(e) => setReportsFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="flex-1 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <select
                        value={reportsFilters.sortBy}
                        onChange={(e) => setReportsFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="date">Date</option>
                        <option value="user">User</option>
                        <option value="type">Type</option>
                      </select>
                      <select
                        value={reportsFilters.sortOrder}
                        onChange={(e) => setReportsFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="desc">↓</option>
                        <option value="asc">↑</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReportsFilters({
                          dateFrom: '',
                          dateTo: '',
                          reporter: '',
                          messageType: 'all',
                          search: '',
                          sortBy: 'date',
                          sortOrder: 'desc'
                        })}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => fetchAllReports(appt._id, reportsFilters, true)}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Report count - compact on mobile */}
                  <div className="text-xs text-gray-600 dark:text-gray-400 text-center sm:text-left">
                    Showing {reports.length} reports for this appointment
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-white dark:bg-gray-800">
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <UrbanSetuSpinner size="md" />
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading reports...</span>
                  </div>
                ) : reportsError ? (
                  <div className="text-sm text-red-600 dark:text-red-400">{reportsError}</div>
                ) : (reports || []).length === 0 ? (
                  <div className="text-center py-12">
                    <FaFlag className="mx-auto text-6xl text-gray-300 dark:text-gray-700 mb-4" />
                    <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Reports</h4>
                    <p className="text-gray-500 dark:text-gray-500">There are no reports for this appointment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(reports || []).filter(r => reportsFilter === 'message' ? r.type === 'message' : r.type !== 'message').map((r, idx) => (
                      <div
                        key={r.notificationId || idx}
                        className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow ${r.messageId ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}`}
                        onClick={() => {
                          if (!r.messageId) return;
                          setShowReportsModal(false);
                          setTimeout(() => {
                            try {
                              const messageElement = document.querySelector(`[data-message-id="${r.messageId}"]`);
                              if (messageElement) {
                                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                const prevOutline = messageElement.style.outline;
                                const prevBoxShadow = messageElement.style.boxShadow;
                                messageElement.style.outline = '2px solid rgba(239,68,68,0.75)';
                                messageElement.style.boxShadow = '0 0 0 4px rgba(239,68,68,0.25)';
                                setTimeout(() => {
                                  messageElement.style.outline = prevOutline || '';
                                  messageElement.style.boxShadow = prevBoxShadow || '';
                                }, 1600);
                              }
                            } catch (_) { }
                          }, 0);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <FaFlag className="text-red-500" /> {r.type === 'message' ? 'Message Report' : 'Chat Report'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(r.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                          {r.reporter && (<div><span className="font-medium text-gray-900 dark:text-gray-100">Reporter:</span> {r.reporter}</div>)}
                          {r.between && (<div><span className="font-medium text-gray-900 dark:text-gray-100">Between:</span> {r.between}</div>)}
                          {r.reason && (<div><span className="font-medium text-gray-900 dark:text-gray-100">Reason:</span> {r.reason}</div>)}
                          {r.details && (<div className="md:col-span-2"><span className="font-medium text-gray-900 dark:text-gray-100">Details:</span> {r.details}</div>)}
                          {r.messageId && (<div><span className="font-medium text-gray-900 dark:text-gray-100">Message ID:</span> {r.messageId}</div>)}
                          {r.messageExcerpt && (
                            <div className="md:col-span-2 italic text-gray-600 dark:text-gray-400">
                              <span className="font-medium not-italic text-gray-900 dark:text-gray-100">Excerpt:</span> “{r.messageExcerpt}”
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ), document.body)}

        {/* Report Details Tooltip */}
        {reportTooltip.show && reportTooltip.details && createPortal((
          <div
            className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-[60] max-w-sm"
            style={{
              left: `${reportTooltip.position.x}px`,
              top: `${reportTooltip.position.y}px`,
              transform: 'translateY(-50%)'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <FaFlag className="text-red-500 text-sm" />
              <span className="font-semibold text-gray-800 dark:text-white text-sm">Report Details</span>
            </div>
            <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
              {reportTooltip.details.reporter && (
                <div><span className="font-medium text-gray-900 dark:text-gray-100">Reporter:</span> {reportTooltip.details.reporter}</div>
              )}
              {reportTooltip.details.reason && (
                <div><span className="font-medium text-gray-900 dark:text-gray-100">Reason:</span> {reportTooltip.details.reason}</div>
              )}
              {reportTooltip.details.details && (
                <div><span className="font-medium text-gray-900 dark:text-gray-100">Details:</span> {reportTooltip.details.details}</div>
              )}
              {reportTooltip.details.messageExcerpt && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs italic">
                  <span className="font-medium not-italic text-gray-900 dark:text-gray-100">Excerpt:</span> "{reportTooltip.details.messageExcerpt}"
                </div>
              )}
              <div className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                {new Date(reportTooltip.details.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ), document.body)}

        {/* Message Info Modal */}
        {showMessageInfoModal && selectedMessageForInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaInfoCircle className="text-blue-500" /> Message Info
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm text-gray-700 dark:text-gray-200">
                  <div className="font-semibold mb-2">Message:</div>
                  <div className="whitespace-pre-wrap break-words">{(selectedMessageForInfo.message || '').slice(0, 200)}{(selectedMessageForInfo.message || '').length > 200 ? '...' : ''}</div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sent:</span>
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      {new Date(selectedMessageForInfo.timestamp).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>

                  {selectedMessageForInfo.deliveredAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Delivered:</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {new Date(selectedMessageForInfo.deliveredAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}

                  {selectedMessageForInfo.readAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Read:</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {new Date(selectedMessageForInfo.readAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}

                  {!selectedMessageForInfo.deliveredAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Not delivered yet</span>
                    </div>
                  )}

                  {selectedMessageForInfo.deliveredAt && !selectedMessageForInfo.readAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">Delivered</span>
                    </div>
                  )}

                  {selectedMessageForInfo.readAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="text-sm text-green-600 dark:text-green-400">Read</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { setShowMessageInfoModal(false); setSelectedMessageForInfo(null); }}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pin Message Modal */}
        {/* Pin Message Modal removed */}

        {/* Call Info Modal */}
        {showCallInfoModal && selectedCallForInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaInfoCircle className="text-blue-500" /> Call Info
              </h3>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm text-gray-700 dark:text-gray-200">
                  <div className="font-semibold mb-2">Call Type:</div>
                  <div>{selectedCallForInfo.callType === 'video' ? 'Video Call' : 'Audio Call'}</div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`text-sm font-medium ${selectedCallForInfo.status === 'accepted' ? 'text-green-600 dark:text-green-400' :
                      selectedCallForInfo.status === 'missed' || selectedCallForInfo.status === 'rejected' || selectedCallForInfo.status === 'cancelled' ? 'text-red-600 dark:text-red-400' :
                        'text-yellow-600 dark:text-yellow-400'
                      }`}>
                      {selectedCallForInfo.status.charAt(0).toUpperCase() + selectedCallForInfo.status.slice(1)}
                    </span>
                  </div>

                  {selectedCallForInfo.duration && selectedCallForInfo.duration > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Duration:</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {(() => {
                          const hours = Math.floor(selectedCallForInfo.duration / 3600);
                          const minutes = Math.floor((selectedCallForInfo.duration % 3600) / 60);
                          const secs = selectedCallForInfo.duration % 60;
                          if (hours > 0) {
                            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                          }
                          return `${minutes}:${secs.toString().padStart(2, '0')}`;
                        })()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Started:</span>
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      {new Date(selectedCallForInfo.startTime || selectedCallForInfo.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Participants:</span>
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      {selectedCallForInfo.callerId?.username || 'Unknown'} → {selectedCallForInfo.receiverId?.username || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => { setShowCallInfoModal(false); setSelectedCallForInfo(null); }}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Call Monitor Modal (admin observer view) */}
        {showLiveMonitorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[90] p-3">
            <div className="bg-gradient-to-br from-gray-900 via-blue-950 to-purple-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative">
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-white">
                  <span
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${activeLiveCall && monitorCallId === activeLiveCall.callId
                      ? 'bg-red-600/90'
                      : 'bg-gray-600/80'
                      }`}
                  >
                    <FaCircle
                      className={`text-[10px] ${activeLiveCall && monitorCallId === activeLiveCall.callId
                        ? 'animate-pulse text-red-100'
                        : 'text-gray-300'
                        }`}
                    />
                    <span>
                      {activeLiveCall && monitorCallId === activeLiveCall.callId ? 'Live Monitor' : 'Not Live'}
                    </span>
                  </span>

                  {/* Call Type Indicator */}
                  {activeLiveCall && monitorCallId === activeLiveCall.callId && (
                    <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-blue-600/90 text-white border border-white/10 shadow-sm transition-all animate-fadeIn">
                      {activeLiveCall.callType === 'video' ? (
                        <FaVideo className="text-[10px]" />
                      ) : (
                        <FaPhone className="text-[10px]" />
                      )}
                      <span>
                        {activeLiveCall.callType === 'video' ? 'Video Call' : 'Audio Call'}
                      </span>
                    </span>
                  )}

                  <span className="hidden sm:inline text-xs sm:text-sm text-white/70">
                    {appt.propertyName || 'Appointment'} • {appt.date ? new Date(appt.date).toLocaleDateString('en-IN') : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowLiveMonitorModal(false);
                      cleanupMonitorPeers();
                    }}
                    className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors shadow"
                    title="Close live monitor"
                    aria-label="Close live monitor"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      setMonitorRefreshing(true);
                      try {
                        // Cleanup existing peers first for a fresh reconnection
                        cleanupMonitorPeers();
                        // Re-fetch latest active call before refreshing monitor
                        let latestActive = activeLiveCall;
                        if (!latestActive || !latestActive.callId) {
                          latestActive = await fetchLatestActiveCall();
                        }

                        if (latestActive && latestActive.callId) {
                          socket.emit('admin-monitor-join', { callId: latestActive.callId });
                        } else {
                          toast.info('No active call detected for this appointment.');
                          cleanupMonitorPeers();
                        }
                      } catch (err) {
                        console.error('[Admin Monitor] Refresh error:', err);
                        toast.error('Failed to refresh monitor');
                      } finally {
                        // Give some time for streams to reconnect before removing spinner
                        setTimeout(() => setMonitorRefreshing(false), 1500);
                      }
                    }}
                    disabled={monitorRefreshing}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border border-white/20 ml-2 transition-all ${
                      monitorRefreshing
                        ? 'bg-white/20 text-white/50 cursor-not-allowed'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title="Refresh live monitor"
                  >
                    <FaSync className={`w-3 h-3 ${monitorRefreshing ? 'animate-spin' : ''}`} />
                    {monitorRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {/* Body */}
              {activeLiveCall && monitorCallId === activeLiveCall.callId ? (
                <>
                  <div className="px-4 sm:px-6 py-3 border-b border-white/10 bg-white/5 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-white/60">Layout</span>
                      <button
                        onClick={() => setFocusedMonitorView(null)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${focusedMonitorView === null
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-transparent text-white/70 border-white/30 hover:border-white/70'
                          }`}
                      >
                        <FaExpand className="text-[10px]" /> Split View
                      </button>
                      <button
                        onClick={() => toggleFocusView('buyer')}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${focusedMonitorView === 'buyer'
                          ? 'bg-yellow-500 text-black border-yellow-400'
                          : 'bg-transparent text-white/70 border-white/30 hover:border-white/70'
                          }`}
                      >
                        <FaUser className="text-[10px]" /> Focus Buyer
                      </button>
                      <button
                        onClick={() => toggleFocusView('seller')}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${focusedMonitorView === 'seller'
                          ? 'bg-yellow-500 text-black border-yellow-400'
                          : 'bg-transparent text-white/70 border-white/30 hover:border-white/70'
                          }`}
                      >
                        <FaUserShield className="text-[10px]" /> Focus Seller
                      </button>
                      <button
                        onClick={() => {
                          if (screenSharingStatus.buyer || screenSharingStatus.seller) {
                            setFocusedMonitorView('presentation');
                          } else {
                            toast.info('No active presentation to focus on');
                          }
                        }}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${focusedMonitorView === 'presentation'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-transparent text-white/70 border-white/30 hover:border-white/70'
                          }`}
                        disabled={!screenSharingStatus.buyer && !screenSharingStatus.seller}
                      >
                        <FaVideo className="text-[10px]" /> Presentation View
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-white/60">Controls</span>
                      <button
                        onClick={() => toggleMonitorAudio('buyer')}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${monitorAudioMuted.buyer ? 'bg-gray-700 text-white' : 'bg-green-500 text-white'
                          }`}
                      >
                        {monitorAudioMuted.buyer ? <FaVolumeMute className="text-[11px]" /> : <FaVolumeUp className="text-[11px]" />}
                        Buyer Audio
                      </button>
                      <button
                        onClick={() => toggleMonitorAudio('seller')}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${monitorAudioMuted.seller ? 'bg-gray-700 text-white' : 'bg-green-500 text-white'
                          }`}
                      >
                        {monitorAudioMuted.seller ? <FaVolumeMute className="text-[11px]" /> : <FaVolumeUp className="text-[11px]" />}
                        Seller Audio
                      </button>
                      {activeLiveCall?.callType === 'video' && (
                        <>
                          <button
                            onClick={() => toggleMonitorVideo('buyer')}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${monitorVideoHidden.buyer ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                              }`}
                          >
                            {monitorVideoHidden.buyer ? <FaEyeSlash className="text-[11px]" /> : <FaEye className="text-[11px]" />}
                            Buyer Video
                          </button>
                          <button
                            onClick={() => toggleMonitorVideo('seller')}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${monitorVideoHidden.seller ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                              }`}
                          >
                            {monitorVideoHidden.seller ? <FaEyeSlash className="text-[11px]" /> : <FaEye className="text-[11px]" />}
                            Seller Video
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setShowForceTerminateModal(true)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        <FaPowerOff className="text-[11px]" /> Terminate Call
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className={`p-4 sm:p-6 grid ${
                      focusedMonitorView === 'presentation'
                        ? 'grid-cols-1 md:grid-cols-4'
                        : focusedMonitorView
                          ? 'grid-cols-1'
                          : 'grid-cols-1 md:grid-cols-2'
                    } gap-4 sm:gap-6`}>
                      {/* Buyer side */}
                      <div className={`flex flex-col h-full rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5 ${
                        focusedMonitorView === 'presentation'
                          ? screenSharingStatus.buyer
                            ? 'md:col-span-3 col-span-1 order-first ring-2 ring-blue-500'
                            : 'md:col-span-1 col-span-1'
                          : focusedMonitorView === 'buyer'
                            ? 'ring-2 ring-yellow-300'
                            : ''
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          <UserAvatar
                            user={{ username: appt.buyerId?.username, avatar: appt.buyerId?.avatar }}
                            size="w-12 h-12"
                            textSize="text-lg"
                            showBorder={true}
                            className="border-2 border-white/60 shadow-lg"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm sm:text-base font-semibold text-white truncate" title={appt.buyerId?.username || 'Buyer'}>
                              {appt.buyerId?.username || 'Buyer'}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-white/60 uppercase tracking-wide">Buyer Side</span>
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${monitorAudioMuted.buyer ? 'bg-gray-700 text-white' : 'bg-green-600 text-white'
                                  }`}
                              >
                                {monitorAudioMuted.buyer ? <FaVolumeMute /> : <FaVolumeUp />} {monitorAudioMuted.buyer ? 'Muted' : 'Audio'}
                              </span>
                              {isBuyerSpeaking && !monitorAudioMuted.buyer && (
                                <div className="bg-green-500 rounded-full p-1 animate-pulse ml-2">
                                  <FaVolumeUp className="text-white text-xs" />
                                </div>
                              )}
                              {participantMediaStatus.buyer.isMuted && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/80 text-white ml-2">
                                  <FaMicrophoneSlash className="text-[9px]" /> Mic Muted
                                </span>
                              )}
                              {screenSharingStatus.buyer && (
                                <div className="flex items-center gap-1 bg-blue-600/90 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm animate-pulse ml-2">
                                  <FaVideo className="text-[10px]" /> Presenting
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`flex-1 rounded-xl bg-black/60 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden ${
                          focusedMonitorView === 'presentation' && !screenSharingStatus.buyer
                            ? 'min-h-[150px] max-h-[200px] md:h-full md:max-h-full'
                            : 'min-h-[300px]'
                        }`}>
                          {buyerMonitorStream ? (
                            <>
                              <video
                                ref={buyerMonitorVideoRef}
                                autoPlay
                                playsInline
                                muted={monitorAudioMuted.buyer}
                                className={`w-full h-full object-contain bg-black transition-all ${(monitorVideoHidden.buyer || (!participantMediaStatus.buyer.isVideoEnabled && !screenSharingStatus.buyer)) ? 'opacity-0' : ''}`}
                              />
                              {activeLiveCall?.callType === 'video' && !participantMediaStatus.buyer.isVideoEnabled && !screenSharingStatus.buyer ? (
                                <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
                                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/60 mb-1">
                                    <FaVideoSlash className="text-2xl" />
                                  </div>
                                  <p className="text-sm font-semibold text-gray-200">Buyer's camera is off</p>
                                  <p className="text-xs text-gray-400 max-w-[200px]">The user has stopped their video feed.</p>
                                </div>
                              ) : activeLiveCall?.callType === 'video' && monitorVideoHidden.buyer ? (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-2 text-xs sm:text-sm">
                                  <FaEyeSlash className="text-lg" />
                                  <span>Buyer video hidden locally</span>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center px-4">
                              {activeLiveCall.callType === 'video' ? (
                                <FaVideo className="text-4xl sm:text-5xl text-white mb-3 animate-pulse" />
                              ) : (
                                <FaPhone className="text-4xl sm:text-5xl text-white mb-3 animate-pulse" />
                              )}
                              <p className="text-white text-sm sm:text-base font-semibold">
                                Waiting for buyer stream - Live {activeLiveCall.callType === 'video' ? 'video' : 'audio'} call
                              </p>
                              <p className="mt-2 text-xs sm:text-sm text-white/70 max-w-xs">
                                As soon as the buyer's device is streaming, the live feed will appear here.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Seller side */}
                      <div className={`flex flex-col h-full rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5 ${
                        focusedMonitorView === 'presentation'
                          ? screenSharingStatus.seller
                            ? 'md:col-span-3 col-span-1 order-first ring-2 ring-blue-500'
                            : 'md:col-span-1 col-span-1'
                          : focusedMonitorView === 'seller'
                            ? 'ring-2 ring-yellow-300'
                            : ''
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          <UserAvatar
                            user={{ username: appt.sellerId?.username, avatar: appt.sellerId?.avatar }}
                            size="w-12 h-12"
                            textSize="text-lg"
                            showBorder={true}
                            className="border-2 border-white/60 shadow-lg"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm sm:text-base font-semibold text-white truncate" title={appt.sellerId?.username || 'Seller'}>
                              {appt.sellerId?.username || 'Seller'}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-white/60 uppercase tracking-wide">Seller Side</span>
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${monitorAudioMuted.seller ? 'bg-gray-700 text-white' : 'bg-green-600 text-white'
                                  }`}
                              >
                                {monitorAudioMuted.seller ? <FaVolumeMute /> : <FaVolumeUp />} {monitorAudioMuted.seller ? 'Muted' : 'Audio'}
                              </span>
                              {isSellerSpeaking && !monitorAudioMuted.seller && (
                                <div className="bg-green-500 rounded-full p-1 animate-pulse ml-2">
                                  <FaVolumeUp className="text-white text-xs" />
                                </div>
                              )}
                              {participantMediaStatus.seller.isMuted && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/80 text-white ml-2">
                                  <FaMicrophoneSlash className="text-[9px]" /> Mic Muted
                                </span>
                              )}
                              {screenSharingStatus.seller && (
                                <div className="flex items-center gap-1 bg-blue-600/90 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm animate-pulse ml-2">
                                  <FaVideo className="text-[10px]" /> Presenting
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`flex-1 rounded-xl bg-black/60 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden ${
                          focusedMonitorView === 'presentation' && !screenSharingStatus.seller
                            ? 'min-h-[150px] max-h-[200px] md:h-full md:max-h-full'
                            : 'min-h-[300px]'
                        }`}>
                          {sellerMonitorStream ? (
                            <>
                              <video
                                ref={sellerMonitorVideoRef}
                                autoPlay
                                playsInline
                                muted={monitorAudioMuted.seller}
                                className={`w-full h-full object-contain bg-black transition-all ${(monitorVideoHidden.seller || (!participantMediaStatus.seller.isVideoEnabled && !screenSharingStatus.seller)) ? 'opacity-0' : ''}`}
                              />
                              {activeLiveCall?.callType === 'video' && !participantMediaStatus.seller.isVideoEnabled && !screenSharingStatus.seller ? (
                                <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
                                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/60 mb-1">
                                    <FaVideoSlash className="text-2xl" />
                                  </div>
                                  <p className="text-sm font-semibold text-gray-200">Seller's camera is off</p>
                                  <p className="text-xs text-gray-400 max-w-[200px]">The user has stopped their video feed.</p>
                                </div>
                              ) : activeLiveCall?.callType === 'video' && monitorVideoHidden.seller ? (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-2 text-xs sm:text-sm">
                                  <FaEyeSlash className="text-lg" />
                                  <span>Seller video hidden locally</span>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center px-4">
                              {activeLiveCall.callType === 'video' ? (
                                <FaVideo className="text-4xl sm:text-5xl text-white mb-3 animate-pulse" />
                              ) : (
                                <FaPhone className="text-4xl sm:text-5xl text-white mb-3 animate-pulse" />
                              )}
                              <p className="text-white text-sm sm:text-base font-semibold">
                                Waiting for seller stream - Mirrored {activeLiveCall.callType === 'video' ? 'video' : 'audio'} feed
                              </p>
                              <p className="mt-2 text-xs sm:text-sm text-white/70 max-w-xs">
                                Once the seller's device is streaming, their live feed will be visible here.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center text-white">
                  <FaVideo className="text-4xl sm:text-5xl text-white/60 mb-4" />
                  <p className="text-lg sm:text-xl font-semibold mb-2">
                    Live call or video is not initiated by other parties
                  </p>
                  <p className="text-xs sm:text-sm text-white/70 mb-6 max-w-xl">
                    When a buyer or seller starts an audio or video call from this appointment, you can monitor it here in real time.
                  </p>
                  <button
                    onClick={() => {
                      navigate('/admin/call-history');
                      setShowLiveMonitorModal(false);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-blue-700 font-semibold text-xs sm:text-sm shadow-lg hover:bg-blue-50 transition-colors"
                  >
                    <FaHistory className="text-sm" />
                    Go to Admin Call History
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {showForceTerminateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[95] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Force Terminate Live Call</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Use this action only when fraud, abuse, or policy violations are detected.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!forceTerminateLoading) {
                      setShowForceTerminateModal(false);
                      setForceTerminateReason('');
                    }
                  }}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <FaTimes />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason (optional)</label>
                <textarea
                  value={forceTerminateReason}
                  onChange={(e) => setForceTerminateReason(e.target.value)}
                  rows={4}
                  placeholder="Example: Buyer attempted to solicit payments outside the platform."
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-3 focus:outline-none focus:ring-2 focus:ring-red-200"
                  disabled={forceTerminateLoading}
                />
              </div>

              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                Both parties will be disconnected immediately and notified that the session was terminated by an administrator.
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    if (!forceTerminateLoading) {
                      setShowForceTerminateModal(false);
                      setForceTerminateReason('');
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600"
                  disabled={forceTerminateLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleForceTerminateCall}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 flex items-center gap-2 disabled:opacity-60"
                  disabled={forceTerminateLoading}
                >
                  {forceTerminateLoading ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} /> Terminating...
                    </>
                  ) : (
                    <>
                      <FaPowerOff /> Terminate Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        <ImagePreview
          isOpen={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          images={previewImages}
          initialIndex={previewIndex}
          listingId={null}
          metadata={{
            addedFrom: 'chat',
            chatType: 'appointment'
          }}
        />

        {/* Video Preview Modal */}
        {showVideoPreviewModal && selectedVideo && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-medium text-gray-700 dark:text-white">Video Preview</span>
                <button
                  onClick={() => { setSelectedVideo(null); setShowVideoPreviewModal(false); }}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 mb-4 min-h-0">
                <video controls className="w-full h-full max-h-[60vh] rounded-lg border dark:border-gray-600" src={videoObjectURL} />
              </div>

              {/* Caption for Video */}
              <div className="relative mb-4">
                <div className="relative">
                  <textarea
                    ref={videoCaptionRef}
                    placeholder={`Add a caption for ${selectedVideo.name}...`}
                    value={videoCaption}
                    onChange={(e) => setVideoCaption(e.target.value)}
                    className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="absolute right-2 top-2">
                    <EmojiButton
                      onEmojiClick={(emoji) => {
                        const textarea = videoCaptionRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newValue = videoCaption.slice(0, start) + emoji + videoCaption.slice(end);
                          setVideoCaption(newValue);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                          }, 0);
                        }
                      }}
                      inputRef={videoCaptionRef}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {videoCaption.length}/500
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-4">{selectedVideo.name}</div>
                <div className="flex gap-2 flex-shrink-0">
                  {uploadingFile ? (
                    <>
                      <button
                        onClick={handleCancelInFlightUpload}
                        className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Cancel
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 w-10 text-right">{uploadProgress}%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setSelectedVideo(null); setShowVideoPreviewModal(false); setVideoCaption(''); }} className="px-4 py-2 rounded-lg border dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                      <button onClick={handleSendSelectedVideo} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all">Send</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {showDocumentPreviewModal && selectedDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-md w-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-medium text-gray-700 dark:text-white">Document Preview</span>
                <button
                  onClick={() => { setSelectedDocument(null); setShowDocumentPreviewModal(false); }}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-600 dark:text-gray-300">📄</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate text-gray-800 dark:text-white">{selectedDocument.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{selectedDocument.type || 'Document'}</div>
                </div>
              </div>

              {/* Caption for Document */}
              <div className="relative mb-4">
                <div className="relative">
                  <textarea
                    ref={documentCaptionRef}
                    placeholder={`Add a caption for ${selectedDocument.name}...`}
                    value={documentCaption}
                    onChange={(e) => setDocumentCaption(e.target.value)}
                    className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="absolute right-2 top-2">
                    <EmojiButton
                      onEmojiClick={(emoji) => {
                        const textarea = documentCaptionRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newValue = documentCaption.slice(0, start) + emoji + documentCaption.slice(end);
                          setDocumentCaption(newValue);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                          }, 0);
                        }
                      }}
                      inputRef={documentCaptionRef}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {documentCaption.length}/500
                </div>
              </div>

              <div className="flex items-center justify-between">
                {uploadingFile ? (
                  <>
                    <button
                      onClick={handleCancelInFlightUpload}
                      className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Cancel
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 w-10 text-right">{uploadProgress}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setSelectedDocument(null); setShowDocumentPreviewModal(false); setDocumentCaption(''); }} className="px-4 py-2 rounded-lg border dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                    <button onClick={handleSendSelectedDocument} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all">Send</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Record Audio Modal */}
        {showRecordAudioModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-2xl max-w-md w-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-medium text-gray-700 dark:text-white">Record Audio</span>
                <button
                  onClick={() => {
                    if (isRecording) {
                      cancelAudioRecording();
                    } else {
                      setShowRecordAudioModal(false);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center py-6">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${isRecording ? 'bg-rose-100 dark:bg-rose-900/30 animate-pulse' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <svg className={`w-10 h-10 ${isRecording ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v8a3 3 0 106 0V4a3 3 0 00-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 11-14 0v-2" />
                  </svg>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {isRecording ? (
                    isPaused ?
                      `${Math.floor(recordingElapsedMs / 60000).toString().padStart(2, '0')}:${Math.floor((recordingElapsedMs % 60000) / 1000).toString().padStart(2, '0')} (Paused)` :
                      `${Math.floor(recordingElapsedMs / 60000).toString().padStart(2, '0')}:${Math.floor((recordingElapsedMs % 60000) / 1000).toString().padStart(2, '0')}`
                  ) : 'Ready'}
                </div>
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button onClick={startAudioRecording} className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">Start</button>
                  ) : (
                    <>
                      <button onClick={stopAudioRecording} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Stop & Preview</button>
                      {isPaused ? (
                        <button onClick={resumeAudioRecording} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">Resume</button>
                      ) : (
                        <button onClick={pauseAudioRecording} className="px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700">Pause</button>
                      )}
                      <button onClick={cancelAudioRecording} className="px-4 py-2 rounded-lg border dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Your mic input stays on device until you choose to send.</div>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// Export ChatSettingsModal in the main component that uses it
// Add this before the final export
const AdminAppointmentsWithSettings = () => {
  // This wrapper ensures ChatSettingsModal is available where needed
  return <AdminAppointments />;
};

