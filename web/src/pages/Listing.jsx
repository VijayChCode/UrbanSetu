import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from "../redux/user/userSlice";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { FaBath, FaBed, FaChair, FaMapMarkerAlt, FaParking, FaShare, FaEdit, FaTrash, FaUndo, FaArrowLeft, FaArrowRight, FaStar, FaLock, FaHeart, FaExpand, FaCheckCircle, FaFlag, FaRuler, FaBuilding, FaTree, FaWifi, FaSwimmingPool, FaCar, FaShieldAlt, FaClock, FaPhone, FaEnvelope, FaCalendarAlt, FaEye, FaThumbsUp, FaThumbsDown, FaRegThumbsUp, FaRegThumbsDown, FaComments, FaCalculator, FaChartLine, FaHome, FaUtensils, FaHospital, FaSchool, FaShoppingCart, FaPlane, FaUser, FaTimes, FaSearch, FaTable, FaRocket, FaQuestionCircle, FaChevronDown, FaChevronUp, FaBookOpen, FaTag, FaCompass, FaInfoCircle, FaCalendar, FaRobot, FaBan, FaExclamationTriangle, FaUserTie, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import ReviewForm from "../components/ReviewForm.jsx";
import ReviewList from "../components/ReviewList.jsx";
import ImagePreview from "../components/ImagePreview.jsx";
import VideoPreview from "../components/VideoPreview.jsx";
import { FaPlay } from "react-icons/fa";
import EMICalculator from "../components/EMICalculator.jsx";
import SocialSharePanel from "../components/SocialSharePanel.jsx";
import SmartPriceInsights from "../components/SmartPriceInsights.jsx";
import EnhancedSmartPriceInsights from "../components/EnhancedSmartPriceInsights.jsx";
import AdvancedAIRecommendations from "../components/AdvancedAIRecommendations";
import ESGDisplay from "../components/ESGDisplay";
import { maskAddress, shouldShowLocationLink, getLocationLinkText } from "../utils/addressMasking";
import { toast } from 'react-toastify';
import { useWishlist } from '../WishlistContext';

import SEO from '../components/SEO';
import RatingDisplay from '../components/ratings/RatingDisplay';
import RentPredictionDisplay from '../components/rental/RentPredictionDisplay';
import LocalityScoreDisplay from '../components/rental/LocalityScoreDisplay';

import VirtualTourViewer from "../components/VirtualTourViewer"; // Import the viewer component
import VirtualStagingTool from "../components/VirtualStagingTool"; // Import Virtual Staging Tool
import ListingSkeleton from "../components/skeletons/ListingSkeleton"; // Import ListingSkeleton
import ListingItem from "../components/ListingItem";
import VerifiedModal from "../components/VerifiedModal";
import PreBookingChatWrapper from "../components/PreBookingChatWrapper";
import { authenticatedFetch } from "../utils/auth";
import { trackInteraction, getLiveRecommendations } from "../utils/sentinelLiveEngine";
import AdvancedImage from "../components/AdvancedImage";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const UNAVAILABLE_STATUSES = ['reserved', 'under_contract', 'rented', 'sold', 'suspended'];
const AVAILABILITY_LABELS = {
  reserved: 'Reserved - Deal In Progress',
  under_contract: 'Under Rent-Lock Review',
  rented: 'Currently Rented',
  sold: 'Sold / Not Available',
  suspended: 'Temporarily On Hold'
};
const LOCK_REASON_MESSAGES = {
  booking_pending: 'An active booking is already in progress for this property.',
  awaiting_payment: 'We are waiting for the existing buyer/tenant to finish payment formalities.',
  contract_in_progress: 'A rent-lock contract is currently being processed for this property.',
  active_rental: 'This property is secured under an active rent-lock contract.',
  sale_in_progress: 'A sale transaction for this property is currently being finalized.',
  admin_hold: 'Our admin team has temporarily paused new bookings for this property.',
  sold: 'This property is no longer available.',
  default: 'This property is temporarily unavailable. Please check back later.'
};

const getVideoPoster = (url) => {
  if (!url) return "";
  if (url.includes('cloudinary.com')) {
    // Cloudinary video thumbnail trick: replace extension with .jpg and add so_1 for better frame capture
    return url.replace(/\.[^/.]+$/, ".jpg").replace("/upload/", "/upload/so_1,f_auto,q_auto/");
  }
  return "";
};

export default function Listing() {
  const listingSchema = (listing) => {
    if (!listing) return null;
    return {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": listing.name,
      "image": listing.imageUrls || [],
      "description": listing.description,
      "sku": listing._id,
      "mpn": listing._id,
      "brand": {
        "@type": "Brand",
        "name": "UrbanSetu"
      },
      "offers": {
        "@type": "Offer",
        "url": window.location.href,
        "priceCurrency": "INR",
        "price": listing.offer ? listing.discountPrice : listing.regularPrice,
        "availability": listing.status === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "itemCondition": "https://schema.org/NewCondition"
      }
    };
  };
  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useSelector((state) => state.user);
  const [listing, setListing] = useState(null);

  // SEO Meta Tags
  const seoTitle = listing ? `${listing.name} in ${listing.city} - For ${listing.type === 'rent' ? 'Rent' : 'Sale'}` : "Property Details";
  const seoDescription = listing ? `${listing.description?.substring(0, 150)}... Buy or rent verified properties on UrbanSetu.` : "View verified property details on UrbanSetu.";
  const seoUrl = listing ? `${window.location.origin}/listing/${listing._id}` : window.location.href;
  const seoImage = listing?.imageUrls?.[0] || `${window.location.origin}/og-image.png`;
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const [ownerDetails, setOwnerDetails] = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const [showReviews, setShowReviews] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [showDronePreview, setShowDronePreview] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [faqs, setFaqs] = useState([]);
  const [relatedBlogs, setRelatedBlogs] = useState([]);
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [faqLoading, setFaqLoading] = useState(false);
  const [blogLoading, setBlogLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userFAQReactions, setUserFAQReactions] = useState({});
  const [faqReactionLoading, setFaqReactionLoading] = useState({});
  const [showAssignOwnerModal, setShowAssignOwnerModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [assignUserSearch, setAssignUserSearch] = useState("");
  const [assignOwnerLoading, setAssignOwnerLoading] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [ownerStatus, setOwnerStatus] = useState({ isActive: false, owner: null });
  const [showDeassignModal, setShowDeassignModal] = useState(false);
  const [deassignReason, setDeassignReason] = useState('');
  const [deassignLoading, setDeassignLoading] = useState(false);
  const [deassignError, setDeassignError] = useState('');
  const [neighborhood, setNeighborhood] = useState(null);

  // Report property states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // Enhanced features states
  const [showAmenities, setShowAmenities] = useState(false);
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false);
  const [showPriceAnalysis, setShowPriceAnalysis] = useState(false);
  const [showSmartPriceInsights, setShowSmartPriceInsights] = useState(false);
  // Real-time analytics data
  const [rtAnalytics, setRtAnalytics] = useState(null);
  const [rtAnalyticsLoading, setRtAnalyticsLoading] = useState(false);
  const [rtAnalyticsError, setRtAnalyticsError] = useState(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [similarProperties, setSimilarProperties] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [daysListed, setDaysListed] = useState(0);
  const [viewTracked, setViewTracked] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonProperties, setComparisonProperties] = useState([]);
  const [showComparisonPanel, setShowComparisonPanel] = useState(true);
  const [showComparisonTooltip, setShowComparisonTooltip] = useState(false);
  const [showPropertySearch, setShowPropertySearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPriceAnalysisTooltip, setShowPriceAnalysisTooltip] = useState(false);
  const [showInsightsTooltip, setShowInsightsTooltip] = useState(false);
  const [showSmartPriceInsightsTooltip, setShowSmartPriceInsightsTooltip] = useState(false);
  const [showReviewsTooltip, setShowReviewsTooltip] = useState(false);
  const [showRentalRatingsTooltip, setShowRentalRatingsTooltip] = useState(false);
  const [showRentPredictionTooltip, setShowRentPredictionTooltip] = useState(false);
  const [showLocalityScoreTooltip, setShowLocalityScoreTooltip] = useState(false);
  const [showRentTooltip, setShowRentTooltip] = useState(false);
  const [showBookAppointmentTooltip, setShowBookAppointmentTooltip] = useState(false);
  const [showLocationTooltip, setShowLocationTooltip] = useState(false);
  const [showWishlistTooltip, setShowWishlistTooltip] = useState(false);
  const [showEsgTooltip, setShowEsgTooltip] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, propertyId: null, origin: null, message: '' });
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [showNearbyTooltip, setShowNearbyTooltip] = useState(false);
  const [showComparisonSocialShare, setShowComparisonSocialShare] = useState(false);
  const [selectedComparisonProperty, setSelectedComparisonProperty] = useState(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [rootVerificationReason, setRootVerificationReason] = useState("");
  const [rootUnpublishReason, setRootUnpublishReason] = useState("");
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [showVirtualStaging, setShowVirtualStaging] = useState(false); // State for Virtual Staging
  const [showVirtualStagingTooltip, setShowVirtualStagingTooltip] = useState(false);
  const [activeVirtualTourIndex, setActiveVirtualTourIndex] = useState(0);
  const [propertyRatings, setPropertyRatings] = useState(null);
  const [showPropertyRatings, setShowPropertyRatings] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [userActiveContract, setUserActiveContract] = useState(null);
  const [rentPrediction, setRentPrediction] = useState(null);
  const [showRentPrediction, setShowRentPrediction] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [localityScore, setLocalityScore] = useState(null);
  const [showLocalityScore, setShowLocalityScore] = useState(false);
  const [localityLoading, setLocalityLoading] = useState(false);
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [propertyIdInput, setPropertyIdInput] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [visibleRecsCount, setVisibleRecsCount] = useState(4);

  const listingAvailabilityStatus = listing?.availabilityStatus;
  const isListingUnavailable = listing && UNAVAILABLE_STATUSES.includes(listingAvailabilityStatus);
  const availabilityLabel = listing
    ? AVAILABILITY_LABELS[listingAvailabilityStatus] || 'Temporarily Unavailable'
    : 'Temporarily Unavailable';
  const availabilityMessage = listing
    ? listing.availabilityMeta?.lockDescription ||
    LOCK_REASON_MESSAGES[listing?.availabilityMeta?.lockReason] ||
    LOCK_REASON_MESSAGES[listingAvailabilityStatus] ||
    LOCK_REASON_MESSAGES.default
    : '';
  const availabilityLockedAt = listing?.availabilityMeta?.lockedAt;

  const isOwnerMatch = currentUser && (
    listing?.userRef === currentUser._id ||
    listing?.userRef?._id === currentUser._id ||
    listing?.sellerId === currentUser._id ||
    listing?.sellerId?._id === currentUser._id
  );

  const refreshWatchlistCount = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/count/${params.listingId}`, { autoRedirect: false });
      if (res.ok) {
        const data = await res.json();
        setWatchlistCount(data.count || 0);
      }
    } catch (e) { }
  };

  const renderReviewsToggleButton = () => (
    <div className="relative">
      <button
        onClick={() => {
          if (!currentUser) {
            showSignInPrompt('reviews');
            return;
          }
          setShowReviews((prev) => !prev);
        }}
        className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-6 py-2 rounded-lg shadow font-semibold flex items-center gap-2 hover:from-yellow-500 hover:to-yellow-700 transition-all"
      >
        {showReviews ? 'Hide Reviews' : 'Show Reviews'}
        {listing?.reviewCount > 0 && (
          <span className="ml-2 bg-white text-yellow-700 rounded-full px-2 py-0.5 text-xs font-bold">
            {listing.reviewCount}
          </span>
        )}
      </button>
      {showReviewsTooltip && (
        <div className="absolute bottom-full left-0 mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
          Please login to view reviews
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
        </div>
      )}
    </div>
  );

  const renderRentalRatingsToggleButton = () => (
    <div className="relative">
      <button
        onClick={async () => {
          if (!currentUser) {
            showSignInPrompt('rentalRatings');
            return;
          }
          if (!showPropertyRatings && !propertyRatings) {
            setRatingsLoading(true);
            try {
              const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/ratings/property/${listing._id}`);
              const data = await res.json();
              if (res.ok && data.success) {
                setPropertyRatings(data);
              }
            } catch (error) {
              console.error('Error fetching property ratings:', error);
            } finally {
              setRatingsLoading(false);
            }
          }
          setShowPropertyRatings((prev) => !prev);
        }}
        className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-2 rounded-lg shadow font-semibold flex items-center gap-2 hover:from-blue-600 hover:to-indigo-700 transition-all"
      >
        {ratingsLoading ? 'Loading...' : showPropertyRatings ? 'Hide Rental Ratings' : 'Show Rental Ratings'}
        {propertyRatings?.statistics?.totalRatings > 0 && (
          <span className="ml-2 bg-white text-blue-700 rounded-full px-2 py-0.5 text-xs font-bold">
            {propertyRatings.statistics.totalRatings}
          </span>
        )}
      </button>
      {showRentalRatingsTooltip && (
        <div className="absolute bottom-full left-0 mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
          Please login to show reviews
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
        </div>
      )}
    </div>
  );

  const fetchWishlistCount = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/wishlist/property-count/${params.listingId}`, { autoRedirect: false });
      if (res.ok) {
        const data = await res.json();
        setWishlistCount(data.count || 0);
      }
    } catch (e) { }
  };

  const openConfirm = (type, { propertyId = null, origin = null, message = 'Are you sure?' } = {}) => {
    setConfirmModal({ open: true, type, propertyId, origin, message });
  };

  const closeConfirm = () => setConfirmModal({ open: false, type: null, propertyId: null, origin: null, message: '' });

  // Check if property is in watchlist
  const checkWatchlistStatus = async () => {
    if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'rootadmin') return;

    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/check/${listing._id}`, { autoRedirect: false });
      if (res.ok) {
        const data = await res.json();
        setIsInWatchlist(data.isInWatchlist);
      }
    } catch (error) {
      console.error('Error checking watchlist status:', error);
    }
  };

  const checkAuthStatus = async () => {
    // Use currentUser from Redux store to determine authentication status
    setIsLoggedIn(!!currentUser);
  };

  const checkUserFAQReactions = async () => {
    try {
      const reactions = {};
      for (const faq of faqs) {
        try {
          const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs/${faq._id}/reaction-status`, { autoRedirect: false });
          if (response.ok) {
            const data = await response.json();
            reactions[faq._id] = data.data.reaction;
          }
        } catch (error) {
          console.error(`Error checking reaction for FAQ ${faq._id}:`, error);
        }
      }
      setUserFAQReactions(reactions);
    } catch (error) {
      console.error('Error checking user FAQ reactions:', error);
    }
  };

  const handleFAQReaction = async (faqId, type) => {
    if (!currentUser) {
      alert('Please log in to rate this FAQ');
      return;
    }

    if (faqReactionLoading[faqId]) return;

    setFaqReactionLoading(prev => ({ ...prev, [faqId]: type }));

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs/${faqId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });

      if (response.ok) {
        const data = await response.json();

        // Update FAQ in the list
        setFaqs(prevFaqs =>
          prevFaqs.map(faq =>
            faq._id === faqId
              ? { ...faq, helpful: data.data.helpful, notHelpful: data.data.notHelpful }
              : faq
          )
        );

        // Update user reactions
        setUserFAQReactions(prev => ({
          ...prev,
          [faqId]: data.data.reaction
        }));

        // User is authenticated if reaction worked
      } else {
        if (response.status === 401) {
          alert('Please log in to rate this FAQ');
          setIsLoggedIn(false);
        } else {
          const errorData = await response.json();
          alert(errorData.message || 'Error rating FAQ');
        }
      }
    } catch (error) {
      console.error('Error rating FAQ:', error);
      alert('Error rating FAQ');
    } finally {
      setFaqReactionLoading(prev => ({ ...prev, [faqId]: null }));
    }
  };

  // Toggle watchlist status
  const toggleWatchlist = async () => {
    if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'rootadmin') return;

    setWatchlistLoading(true);
    try {
      if (isInWatchlist) {
        // Remove from watchlist
        const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/remove/${listing._id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setIsInWatchlist(false);
          toast.success('Property removed from watchlist');
        } else {
          toast.error('Failed to remove from watchlist');
        }
      } else {
        // Add to watchlist
        const res = await authenticatedFetch(`${API_BASE_URL}/api/watchlist/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ listingId: listing._id })
        });
        if (res.ok) {
          setIsInWatchlist(true);
          toast.success(
            <div>
              Property added to watchlist! Future price insights will be notified. <Link to="/user/watchlist" className="font-bold underline ml-1">View Watchlist</Link>
            </div>
          );
        } else {
          const data = await res.json();
          if (data.message?.includes('already')) {
            setIsInWatchlist(true);
            toast.info(
              <div>
                Property is already in your watchlist. <Link to="/user/watchlist" className="font-bold underline ml-1">View Watchlist</Link>
              </div>
            );
          } else {
            toast.error('Failed to add to watchlist.');
          }
        }
      }

    } catch (error) {
      console.error('Error toggling watchlist:', error);
      toast.error('Failed to update watchlist.');
    } finally {
      setWatchlistLoading(false);
    }
  };

  const confirmYes = async () => {
    const { type, propertyId, origin } = confirmModal;

    if (type === 'root-verify') {
      // Check if owner is present
      if (!listing?.userRef || !ownerDetails) {
        toast.error('Cannot verify: Property owner details are missing. Please assign an owner first.');
        closeConfirm();
        return;
      }

      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/root-verify/${listing._id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: rootVerificationReason })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Property verified and published successfully!');
          setRootVerificationReason(""); // reset
          window.location.reload();
        } else {
          toast.error(data.message || 'Failed to verify property');
        }
      } catch (error) {
        console.error(error);
        toast.error('Error connecting to server');
      }
    }

    if (type === 'root-unpublish') {
      if (!rootUnpublishReason || !rootUnpublishReason.trim()) {
        toast.error('A reason is required to unpublish this listing');
        return; // Don't close modal if invalid
      }

      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/root-unpublish/${listing._id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: rootUnpublishReason })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Property has been unpublished and owner notified.');
          setRootUnpublishReason(""); // reset
          window.location.reload();
        } else {
          toast.error(data.message || 'Failed to unpublish property');
        }
      } catch (error) {
        console.error(error);
        toast.error('Error connecting to server');
      }
    }

    if (type === 'remove-one' && propertyId) {
      removeFromComparison(propertyId);
    }
    if (type === 'clear-all') {
      setComparisonProperties([]);
      if (origin === 'comparison') {
        setShowComparisonModal(false);
        setShowPropertySearch(true);
      } else if (origin === 'search') {
        // keep search modal open to add more
        setShowPropertySearch(true);
      }
    }
    closeConfirm();
  };

  // Lock body scroll when deletion/assign/report/calculator/comparison/search/AI recommendation modals are open
  useEffect(() => {
    const shouldLock = showReasonModal || showPasswordModal || showAssignOwnerModal || showDeassignModal || showReportModal || showCalculatorModal || showComparisonModal || showPropertySearch || showAIRecommendations;
    if (shouldLock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showReasonModal, showPasswordModal, showAssignOwnerModal, showDeassignModal, showReportModal, showCalculatorModal, showComparisonModal, showPropertySearch, showAIRecommendations]);

  // Check if user is admin
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'rootadmin';

  // Check if we're in admin context
  const isAdminContext = location.pathname.includes('/admin');

  // Determine back button destination and text
  const getBackButtonInfo = () => {
    if (!currentUser) {
      // Public user - go to home
      return { path: '/', text: 'Back to Home' };
    } else if (isAdminContext) {
      // Admin context - go to admin dashboard
      return { path: '/admin', text: 'Back to Dashboard' };
    } else {
      // User context - go to user dashboard
      return { path: '/user', text: 'Back to Home' };
    }
  };

  const backButtonInfo = getBackButtonInfo();

  const formatINR = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN")}`;
  };

  // Calculate discount percentage
  const getDiscountPercentage = () => {
    if (listing.offer && listing.regularPrice && listing.discountPrice) {
      return Math.round(((listing.regularPrice - listing.discountPrice) / listing.regularPrice) * 100);
    }
    return 0;
  };

  const handleDelete = () => {
    setDeleteReason("");
    setDeleteError("");
    setShowReasonModal(true);
  };

  // Owner delete: open password confirm directly (same as MyListings behavior)
  const handleOwnerDeleteClick = () => {
    setDeleteReason("");
    setDeleteError("");
    setDeletePassword("");
    setShowPasswordModal(true);
  };

  const handleReasonSubmit = (e) => {
    e.preventDefault();
    if (!deleteReason.trim()) {
      setDeleteError("Reason is required");
      return;
    }
    setShowReasonModal(false);
    setDeleteError("");
    setShowPasswordModal(true);
  };

  const handleImageClick = (index) => {
    setSelectedImageIndex(index);
    setShowImagePreview(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError("Password is required");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      // Verify password
      const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!verifyRes.ok) {
        // Track wrong attempts locally (allow up to 3 attempts before logout)
        const key = 'deleteListingPwAttempts';
        const prev = parseInt(localStorage.getItem(key) || '0');
        const next = prev + 1;
        localStorage.setItem(key, String(next));

        if (next >= 3) {
          // Sign out and redirect on third wrong attempt
          toast.error("Too many incorrect attempts. You've been signed out for security.");
          dispatch(signoutUserStart());
          try {
            const signoutRes = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
            const signoutData = await signoutRes.json();
            if (signoutData.success === false) {
              dispatch(signoutUserFailure(signoutData.message));
            } else {
              dispatch(signoutUserSuccess(signoutData));
            }
          } catch (err) {
            dispatch(signoutUserFailure(err.message));
          }
          localStorage.removeItem(key); // Clear attempts on logout
          setShowPasswordModal(false);
          setTimeout(() => {
            navigate('/sign-in');
          }, 800);
          return;
        }

        const remaining = 3 - next;
        setDeleteError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before logout.`);
        setDeleteLoading(false);
        return;
      }

      // Success - Clear attempts
      localStorage.removeItem('deleteListingPwAttempts');

      // Proceed to delete
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/delete/${listing._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (res.ok) {
        toast.success('Property deleted successfully!');
        setShowPasswordModal(false);
        if (isAdmin) {
          navigate('/admin/listings');
        } else {
          navigate('/user/my-listings');
        }
      } else {
        const data = await res.json();
        setDeleteError(data.message || 'Failed to delete property.');
      }
    } catch (error) {
      setDeleteError('An error occurred while deleting the property.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Function to check if current owner is active
  const checkOwnerStatus = async () => {
    if (listing && listing.userRef) {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/user/id/${listing.userRef}`, { autoRedirect: false });
        if (res.ok) {
          const ownerData = await res.json();
          if (ownerData && ownerData.status !== 'suspended') {
            return { isActive: true, owner: ownerData };
          }
        }
      } catch (error) {
        // Owner account is deleted/inactive
        return { isActive: false, owner: null };
      }
    }
    return { isActive: false, owner: null };
  };

  // Function to fetch available users for owner assignment
  const fetchAvailableUsers = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/all-users-autocomplete`);
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data);
      } else {
        console.error('Failed to fetch available users');
      }
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const openDeassignOwnerModal = () => {
    setDeassignReason('');
    setDeassignError('');
    setShowDeassignModal(true);
  };

  const handleDeassignOwnerSubmit = async (e) => {
    e.preventDefault();
    if (!deassignReason.trim()) {
      setDeassignError('Reason is required');
      return;
    }
    setDeassignLoading(true);
    setDeassignError('');
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/deassign-owner/${listing._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deassignReason.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to deassign owner');
      }
      toast.success(data.message || 'Owner removed from this property');
      setOwnerDetails(null);
      setOwnerStatus({ isActive: false, owner: null });
      setOwnerError('No owner assigned yet');
      setListing((prev) => (prev ? { ...prev, userRef: null } : prev));
      setShowDeassignModal(false);
    } catch (error) {
      console.error('Error deassigning owner:', error);
      setDeassignError(error.message || 'Failed to deassign owner');
    } finally {
      setDeassignLoading(false);
    }
  };

  // Function to handle property report
  const handleReportProperty = async () => {
    if (!reportCategory) {
      toast.error('Please select a report category');
      return;
    }

    setReportLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/report/${listing._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: reportCategory,
          details: reportDetails.trim()
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.info("Thank you for reporting. Our team will review this property.");
        setShowReportModal(false);
        setReportCategory('');
        setReportDetails('');
      } else {
        toast.error(data.message || 'Failed to report property');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  // Function to assign new owner
  const handleAssignNewOwner = async () => {
    if (!selectedNewOwner) {
      toast.error('Please select a new owner');
      return;
    }

    setAssignOwnerLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/reassign-owner/${listing._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerId: selectedNewOwner }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Property owner assigned successfully!');
        setShowAssignOwnerModal(false);
        setSelectedNewOwner("");
        // Refresh the page to show updated owner details
        window.location.reload();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to assign new owner');
      }
    } catch (error) {
      console.error('Error assigning new owner:', error);
      toast.error('An error occurred while assigning new owner');
    } finally {
      setAssignOwnerLoading(false);
    }
  };

  // Function to fetch similar properties
  const fetchSimilarProperties = async () => {
    if (!listing || !currentUser) return;

    setLoadingSimilar(true);
    try {
      // UPGRADE: Use AI Vector Search for TRUE semantic similarity!
      const query = `A ${listing.bedrooms} BHK ${listing.type} property in ${listing.city} with ${listing.furnished ? 'furnished' : 'unfurnished'} interior`;
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/ai-search?query=${encodeURIComponent(query)}&limit=5`);

      if (res.ok) {
        const responseData = await res.json();
        if (responseData.success && responseData.data.length > 0) {
          // Filter out current listing and strictly match city
          const filteredProps = responseData.data.filter(prop =>
            prop._id !== listing._id &&
            prop.city?.toLowerCase() === listing.city?.toLowerCase()
          );

          if (filteredProps.length > 0) {
            setSimilarProperties(filteredProps.slice(0, 3));
          } else {
            throw new Error("No AI results found in the same city");
          }
        } else {
          throw new Error("No AI results found");
        }
      } else {
        throw new Error("AI search failed");
      }
    } catch (error) {
      console.warn('AI search fallback to classic matching:', error.message);
      try {
        const resClassic = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?type=${listing.type}&city=${listing.city}&limit=4&exclude=${listing._id}&visibility=public`);
        if (resClassic.ok) {
          const data = await resClassic.json();
          setSimilarProperties(data.filter(prop => prop._id !== listing._id).slice(0, 3));
        }
      } catch (fbError) {
        console.error('Classic fallback failed:', fbError);
      }
    } finally {
      setLoadingSimilar(false);
    }
  };

  // Function to track property view (robust dedup; fire-and-forget)
  const trackPropertyView = async () => {
    if (!listing || viewTracked) return;
    try {
      // Fire-and-forget; backend dedupes by user/guest within 6h and ignores admin/owner
      authenticatedFetch(`${API_BASE_URL}/api/properties/${listing._id}/view`, {
        method: 'POST',
        keepalive: true,
        autoRedirect: false
      }).catch(() => { });
    } finally {
      setViewTracked(true);
    }
  };

  // Function to calculate EMI (for sale properties)
  const calculateEMI = (principal, rate = 8.5, tenure = 20) => {
    const monthlyRate = rate / 12 / 100;
    const months = tenure * 12;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    return Math.round(emi);
  };

  // Function to add property to comparison
  const addToComparison = (property) => {
    if (!currentUser) {
      setShowComparisonTooltip(true);
      setTimeout(() => setShowComparisonTooltip(false), 3000);
      return;
    }

    if (comparisonProperties.length >= 4) {
      toast.error('You can compare maximum 4 properties');
      return;
    }

    if (comparisonProperties.some(p => p._id === property._id)) {
      toast.error('Property already added to comparison');
      return;
    }

    setComparisonProperties(prev => [...prev, property]);
    toast.success('Property added to comparison');
  };

  // Function to remove property from comparison
  const removeFromComparison = (propertyId) => {
    setComparisonProperties(prev => prev.filter(p => p._id !== propertyId));
    toast.success('Property removed from comparison');
  };

  // Function to open comparison modal
  const openComparisonModal = () => {
    if (!currentUser) {
      setShowComparisonTooltip(true);
      setTimeout(() => setShowComparisonTooltip(false), 3000);
      return;
    }

    if (comparisonProperties.length < 2) {
      toast.error('Please select at least 2 properties to compare');
      return;
    }

    setShowComparisonModal(true);
  };

  // Function to get comparison data for a property
  const getComparisonData = (property) => {
    return {
      basicInfo: {
        name: property.name,
        location: `${property.city}, ${property.state}`,
        type: property.type,
        bhk: property.bhk,
        furnished: property.furnished ? 'Furnished' : 'Unfurnished'
      },
      pricing: {
        price: property.offer ? property.discountPrice : property.regularPrice,
        pricePerSqFt: property.area ? Math.round((property.offer ? property.discountPrice : property.regularPrice) / property.area) : 'N/A',
        originalPrice: property.regularPrice,
        discount: property.offer ? property.regularPrice - property.discountPrice : 0
      },
      size: {
        area: property.area || 'N/A',
        floor: property.floor !== undefined && property.floor !== null && property.floor !== '' ?
          (property.floor == 0 ? 'Ground Floor' : `Floor ${property.floor}`) : 'Not specified',
        age: property.propertyAge || 'N/A'
      },
      amenities: {
        parking: property.parking ? 'Yes' : 'No',
        wifi: property.wifi ? 'Yes' : 'No',
        powerBackup: property.powerBackup ? 'Yes' : 'No',
        lift: property.lift ? 'Yes' : 'No',
        gym: property.gym ? 'Yes' : 'No',
        security: property.security ? 'Yes' : 'No'
      },
      reviews: {
        rating: property.averageRating || 0,
        totalReviews: property.reviewCount || 0,
        views: property.viewCount || 0
      }
    };
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchProperties(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Function to search for properties
  const searchProperties = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      // Use backend search functionality with forSuggestion=true to bypass strict filters
      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?searchTerm=${encodeURIComponent(query)}&limit=10&forSuggestion=true`);
      if (res.ok) {
        const data = await res.json();

        // Filter out current listing and already selected properties
        const filteredResults = data.filter(property => {
          if (!listing) return true;
          return property._id !== listing._id && !comparisonProperties.some(p => p._id === property._id);
        });

        setSearchResults(filteredResults);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching properties:', error);
      toast.error('Failed to search properties');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Function to open property search modal
  const openPropertySearch = () => {
    if (!currentUser) {
      setShowComparisonTooltip(true);
      setTimeout(() => setShowComparisonTooltip(false), 3000);
      return;
    }
    setShowPropertySearch(true);
  };

  // Function to add property from search results
  const addPropertyFromSearch = (property) => {
    if (comparisonProperties.length >= 4) {
      toast.error('You can compare maximum 4 properties');
      return;
    }

    if (comparisonProperties.some(p => p._id === property._id)) {
      toast.error('Property already added to comparison');
      return;
    }

    setComparisonProperties(prev => [...prev, property]);
    toast.success('Property added to comparison');

    // Remove from search results
    setSearchResults(prev => prev.filter(p => p._id !== property._id));
  };

  // Function to show sign-in prompt for specific features
  const showSignInPrompt = (tooltipType) => {
    // Hide all tooltips first
    setShowPriceAnalysisTooltip(false);
    setShowInsightsTooltip(false);
    setShowSmartPriceInsightsTooltip(false);
    setShowComparisonTooltip(false);
    setShowReviewsTooltip(false);
    setShowRentalRatingsTooltip(false);
    setShowRentPredictionTooltip(false);
    setShowLocalityScoreTooltip(false);
    setShowRentTooltip(false);
    setShowBookAppointmentTooltip(false);
    setShowLocationTooltip(false);
    setShowWishlistTooltip(false);
    setShowWishlistTooltip(false);
    setShowEsgTooltip(false);
    setShowNearbyTooltip(false);
    setShowVirtualStagingTooltip(false);

    // Show the specific tooltip
    switch (tooltipType) {
      case 'priceAnalysis':
        setShowPriceAnalysisTooltip(true);
        setTimeout(() => setShowPriceAnalysisTooltip(false), 3000);
        break;
      case 'insights':
        setShowInsightsTooltip(true);
        setTimeout(() => setShowInsightsTooltip(false), 3000);
        break;
      case 'smartPriceInsights':
        setShowSmartPriceInsightsTooltip(true);
        setTimeout(() => setShowSmartPriceInsightsTooltip(false), 3000);
        break;
      case 'comparison':
        setShowComparisonTooltip(true);
        setTimeout(() => setShowComparisonTooltip(false), 3000);
        break;
      case 'reviews':
        setShowReviewsTooltip(true);
        setTimeout(() => setShowReviewsTooltip(false), 3000);
        break;
      case 'rentalRatings':
        setShowRentalRatingsTooltip(true);
        setTimeout(() => setShowRentalRatingsTooltip(false), 3000);
        break;
      case 'rentPrediction':
        setShowRentPredictionTooltip(true);
        setTimeout(() => setShowRentPredictionTooltip(false), 3000);
        break;
      case 'localityScore':
        setShowLocalityScoreTooltip(true);
        setTimeout(() => setShowLocalityScoreTooltip(false), 3000);
        break;
      case 'rent':
        setShowRentTooltip(true);
        setTimeout(() => setShowRentTooltip(false), 3000);
        break;
      case 'appointment':
        setShowBookAppointmentTooltip(true);
        setTimeout(() => setShowBookAppointmentTooltip(false), 3000);
        break;
      case 'location':
        setShowLocationTooltip(true);
        setTimeout(() => setShowLocationTooltip(false), 3000);
        break;
      case 'wishlist':
        setShowWishlistTooltip(true);
        setTimeout(() => setShowWishlistTooltip(false), 3000);
        break;
      case 'esg':
        setShowEsgTooltip(true);
        setTimeout(() => setShowEsgTooltip(false), 3000);
        break;
      case 'nearby':
        setShowNearbyTooltip(true);
        setTimeout(() => setShowNearbyTooltip(false), 3000);
        break;
      case 'virtualStaging':
        setShowVirtualStagingTooltip(true);
        setTimeout(() => setShowVirtualStagingTooltip(false), 3000);
        break;
      default:
        break;
    }
  };

  // Function to get amenities list
  const getAmenities = () => {
    const amenities = [];
    if (listing.parking) amenities.push({ name: 'Parking', icon: <FaCar />, color: 'text-blue-600' });
    if (listing.furnished) amenities.push({ name: 'Furnished', icon: <FaChair />, color: 'text-green-600' });
    if (listing.garden) amenities.push({ name: 'Garden', icon: <FaTree />, color: 'text-green-500' });
    if (listing.swimmingPool) amenities.push({ name: 'Swimming Pool', icon: <FaSwimmingPool />, color: 'text-blue-500' });
    if (listing.wifi) amenities.push({ name: 'WiFi', icon: <FaWifi />, color: 'text-purple-600' });
    if (listing.security) amenities.push({ name: '24/7 Security', icon: <FaShieldAlt />, color: 'text-red-600' });
    if (listing.gym) amenities.push({ name: 'Gym', icon: <FaBuilding />, color: 'text-orange-600' });
    if (listing.lift) amenities.push({ name: 'Lift', icon: <FaBuilding />, color: 'text-gray-600' });
    return amenities;
  };

  // Function to get nearby places with static data based on property
  const getNearbyPlaces = () => {
    if (!listing) return [];

    // Prefer real-time analytics if available
    if (rtAnalytics && rtAnalytics.locationData) {
      const { locationData } = rtAnalytics;
      const amenities = locationData.amenities || {};
      const transport = locationData.transportData || { stations: [] };

      const mk = (name, icon, arrOrCount) => ({
        name,
        icon,
        distance: arrOrCount && Array.isArray(arrOrCount) && arrOrCount.length > 0 && typeof arrOrCount[0].distance === 'number'
          ? `${Math.max(0.1, Math.min(...arrOrCount.map(i => i.distance))).toFixed(1)} km`
          : '—',
        count: Array.isArray(arrOrCount) ? `${arrOrCount.length}` : `${arrOrCount || 0}`,
        category: name.toLowerCase()
      });

      const items = [
        mk('Restaurants', <FaUtensils />, amenities.restaurant || amenities.restaurants || []),
        mk('Hospitals', <FaHospital />, amenities.hospital || amenities.hospitals || []),
        mk('Schools', <FaSchool />, amenities.school || amenities.schools || []),
        mk('Shopping Malls', <FaShoppingCart />, amenities.shopping_mall || amenities.mall || amenities.malls || []),
        mk('Airport', <FaPlane />, amenities.airport || []),
        mk('Transit Stations', <FaPlane />, transport.stations || [])
      ];

      // Always show items, including zero-count categories
      return items;
    }

    // Use property ID hash to generate consistent values
    const propertyId = listing._id;
    const hash = propertyId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    // Generate consistent distances based on property ID
    const baseDistance = (Math.abs(hash) % 200) / 100 + 0.3; // 0.3 to 2.3 km
    const hospitalDistance = (Math.abs(hash * 2) % 300) / 100 + 0.5; // 0.5 to 3.5 km
    const schoolDistance = (Math.abs(hash * 3) % 200) / 100 + 0.2; // 0.2 to 2.2 km
    const mallDistance = (Math.abs(hash * 4) % 500) / 100 + 1; // 1 to 6 km
    const airportDistance = (Math.abs(hash * 5) % 3000) / 100 + 15; // 15 to 45 km

    // Generate consistent counts based on city and property ID
    const cityMultiplier = listing.city === 'Mumbai' || listing.city === 'Delhi' || listing.city === 'Bangalore' ? 1.5 : 1;
    const restaurantCount = Math.floor((Math.abs(hash * 6) % 200) / 10 * cityMultiplier) + 10;
    const hospitalCount = Math.floor((Math.abs(hash * 7) % 50) / 10 * cityMultiplier) + 3;
    const schoolCount = Math.floor((Math.abs(hash * 8) % 80) / 10 * cityMultiplier) + 5;
    const mallCount = Math.floor((Math.abs(hash * 9) % 30) / 10 * cityMultiplier) + 2;

    return [
      {
        name: 'Restaurants',
        icon: <FaUtensils />,
        distance: `${baseDistance.toFixed(1)} km`,
        count: `${restaurantCount}+`,
        category: 'food'
      },
      {
        name: 'Hospitals',
        icon: <FaHospital />,
        distance: `${hospitalDistance.toFixed(1)} km`,
        count: `${hospitalCount}`,
        category: 'healthcare'
      },
      {
        name: 'Schools',
        icon: <FaSchool />,
        distance: `${schoolDistance.toFixed(1)} km`,
        count: `${schoolCount}`,
        category: 'education'
      },
      {
        name: 'Shopping Malls',
        icon: <FaShoppingCart />,
        distance: `${mallDistance.toFixed(1)} km`,
        count: `${mallCount}`,
        category: 'shopping'
      },
      {
        name: 'Airport',
        icon: <FaPlane />,
        distance: `${airportDistance.toFixed(0)} km`,
        count: '1',
        category: 'transport'
      }
    ];
  };

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get/${params.listingId}`);
        const data = await res.json();
        if (data.success === false) {
          return;
        }
        setListing(data);
      } catch (error) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
    fetchWishlistCount();
    // Refresh watchlist count for admins
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin')) {
      refreshWatchlistCount();
      const interval = setInterval(refreshWatchlistCount, 30000);
      return () => clearInterval(interval);
    }
  }, [params.listingId]);

  // Fetch FAQs for this property
  useEffect(() => {
    const fetchFAQs = async () => {
      if (!listing?._id) return;
      setFaqLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/faqs?propertyId=${listing._id}`);
        if (response.ok) {
          const data = await response.json();
          setFaqs(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching FAQs:', error);
      } finally {
        setFaqLoading(false);
      }
    };
    fetchFAQs();
  }, [listing?._id]);

  // Update authentication status when currentUser changes
  useEffect(() => {
    checkAuthStatus();
  }, [currentUser]);

  // Check user reactions when logged in and FAQs are loaded
  useEffect(() => {
    if (isLoggedIn && faqs.length > 0) {
      checkUserFAQReactions();
    }
  }, [isLoggedIn, faqs]);

  // Fetch related blogs for this property
  useEffect(() => {
    const fetchRelatedBlogs = async () => {
      if (!listing?._id) return;
      setBlogLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/blogs?propertyId=${listing._id}&published=true&limit=3`);
        if (response.ok) {
          const data = await response.json();
          setRelatedBlogs(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching related blogs:', error);
      } finally {
        setBlogLoading(false);
      }
    };
    fetchRelatedBlogs();
  }, [listing?._id]);

  // Check watchlist status when listing is loaded
  useEffect(() => {
    if (listing && currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
      checkWatchlistStatus();
    }
  }, [listing, currentUser]);

  // Check if current user has an active contract for this listing
  useEffect(() => {
    const fetchUserContract = async () => {
      if (!currentUser || !listing?._id || listing.type !== 'rent') return;

      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts?status=active`);
        const data = await res.json();
        if (res.ok && data.success) {
          // Find contract for this listing where user is tenant or landlord
          const contract = data.contracts?.find(c => {
            const listingId = c.listingId?._id || c.listingId;
            return listingId?.toString() === listing._id.toString() &&
              (c.status === 'active' || c.status === 'expired');
          });
          setUserActiveContract(contract || null);
        }
      } catch (error) {
        // Silently fail - not critical
      }
    };
    fetchUserContract();
  }, [currentUser, listing?._id, listing?.type]);

  useEffect(() => {
    const fetchNeighborhood = async () => {
      if (!currentUser) return;
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/api/ai/neighborhood/${params.listingId}`);
        if (res.ok) {
          const data = await res.json();
          setNeighborhood(data);
        }
      } catch (_) { }
    };
    fetchNeighborhood();
  }, [params.listingId, currentUser]);

  // Fetch real-time analytics (market, location, weather, investment)
  useEffect(() => {
    const fetchRtAnalytics = async () => {
      if (!listing || !listing._id || !currentUser) return;
      try {
        setRtAnalyticsLoading(true);
        setRtAnalyticsError(null);
        const res = await authenticatedFetch(`${API_BASE_URL}/api/analytics/property/${listing._id}/analytics`, {
          method: 'GET',
          autoRedirect: false
        });
        if (!res.ok) throw new Error('Failed to load analytics');
        const json = await res.json();
        const data = json.data || json;
        setRtAnalytics(data);

        // Opportunistically enrich existing neighborhood data for price analysis and insights UI
        setNeighborhood(prev => ({
          ...(prev || {}),
          averagePriceNearby: data?.marketData?.averagePrice || (prev && prev.averagePriceNearby) || undefined,
          nearbyAmenities: prev && prev.nearbyAmenities ? prev.nearbyAmenities : Object.keys(data?.locationData?.amenities || {})
        }));
      } catch (error) {
        setRtAnalyticsError(error.message);
      } finally {
        setRtAnalyticsLoading(false);
      }
    };
    fetchRtAnalytics();
  }, [listing?._id, currentUser]);

  // Reset view tracking when listing ID changes
  useEffect(() => {
    setViewTracked(false);
  }, [params.listingId]);

  // Track property view when listing loads
  useEffect(() => {
    if (listing) {
      // ONLY track/record for logged-in regular users (not guest, not admin, not rootadmin)
      if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') {
        trackPropertyView();
        trackInteraction(listing); // STN-LIVE: Record session activity
      }

      fetchSimilarProperties();
      // Calculate days listed once
      const createdDate = new Date(listing.createdAt);
      const currentDate = new Date();
      const daysDiff = Math.floor((currentDate - createdDate) / (1000 * 60 * 60 * 24));
      setDaysListed(daysDiff);
    }
  }, [listing, currentUser]); // Added currentUser to dependencies for re-check on login state change

  // Fetch owner details after listing is loaded
  useEffect(() => {
    const fetchOwnerDetails = async () => {
      const ownerId = typeof listing?.userRef === 'object' ? listing.userRef._id : listing?.userRef;
      if (listing && ownerId) {
        setOwnerLoading(true);
        setOwnerError("");
        try {
          const res = await authenticatedFetch(`${API_BASE_URL}/api/user/id/${ownerId}`);
          if (!res.ok) throw new Error("Failed to fetch owner details");
          const data = await res.json();
          setOwnerDetails(data);
          setOwnerStatus({ isActive: true, owner: data });
        } catch (err) {
          setOwnerError("Could not load owner details");
          setOwnerDetails(null);
          setOwnerStatus({ isActive: false, owner: null });
        } finally {
          setOwnerLoading(false);
        }
      } else {
        setOwnerDetails(null);
        setOwnerStatus({ isActive: false, owner: null });
      }
    };
    fetchOwnerDetails();
  }, [listing]);

  // Fetch recommendations for Not Found state
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (listing || !loading) {
        // Only run if listing is null and NOT loading (meaning fetch finished but no property found)
        if (listing) return;
      } else {
        return;
      }

      try {
        setRecsLoading(true);
        // Fetch public listings
        const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/get?limit=20&visibility=public`);
        if (!res.ok) return;
        const data = await res.json();
        const listings = Array.isArray(data) ? data : (data?.listings || []);

        if (currentUser) {
          // Sentinel Live recommendations
          let userPreferences = [];
          try {
            const [wishRes, watchRes] = await Promise.all([
              authenticatedFetch(`${API_BASE_URL}/api/wishlist/user/${currentUser._id}`),
              authenticatedFetch(`${API_BASE_URL}/api/watchlist/user/${currentUser._id}`)
            ]);
            const wishData = wishRes.ok ? await wishRes.json() : [];
            const watchData = watchRes.ok ? await watchRes.json() : [];
            const wishItems = Array.isArray(wishData) ? wishData.filter(x => x.listingId).map(x => x.listingId) : [];
            const watchItems = Array.isArray(watchData) ? watchData.filter(x => x.listingId).map(x => x.listingId) : [];
            userPreferences = [...wishItems, ...watchItems];
          } catch (e) {
            console.error("Error fetching user preferences:", e);
          }

          const validListings = listings.filter(l =>
            l.userRef !== currentUser._id &&
            l.sellerId !== currentUser._id
          );

          const recs = await getLiveRecommendations(validListings, 12, userPreferences);
          setRecommendations(recs.length > 0 ? recs : listings.sort(() => 0.5 - Math.random()).slice(0, 8));
        } else {
          setRecommendations(listings.sort(() => 0.5 - Math.random()).slice(0, 8));
        }
      } catch (error) {
        console.error("Failed to fetch recommendations", error);
      } finally {
        setRecsLoading(false);
      }
    };

    if (!listing && !loading) {
      fetchRecommendations();
    }
  }, [listing, loading, currentUser]);

  const handleIdSearch = (e) => {
    e.preventDefault();
    if (propertyIdInput.trim()) {
      navigate(`/listing/${propertyIdInput.trim()}`);
      setPropertyIdInput("");
    }
  };

  if (loading) {
    return <ListingSkeleton />;
  }

  if (!listing) {
    const explorePath = currentUser ? (isAdmin ? "/admin/explore" : "/user/search") : "/search";

    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-950 dark:to-gray-900 min-h-screen py-10 px-4 md:px-8 transition-colors duration-300 relative overflow-hidden">
        {/* Dynamic Background Blobs */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[10%] left-[20%] w-72 h-72 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[100px] animate-blob"></div>
          <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 flex flex-col gap-12">
          {/* Main Not Found Card */}
          <div className="max-w-2xl mx-auto w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-3xl shadow-2xl p-8 md:p-12 text-center animate-fade-in-up">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-4xl" />
            </div>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">Property Not Found</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              The property you're looking for doesn't exist, has been removed, or the ID is incorrect.
            </p>

            {/* ID Search Field */}
            <div className="mb-10 group">
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 text-left ml-1 flex items-center gap-2">
                <FaCompass className="text-blue-500" /> Have a direct Property ID?
              </p>
              <form onSubmit={handleIdSearch} className="relative">
                <input
                  type="text"
                  placeholder="Enter 24-char Property ID (e.g. 685e0850...)"
                  value={propertyIdInput}
                  onChange={(e) => setPropertyIdInput(e.target.value)}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-blue-500 dark:focus:border-blue-400 rounded-2xl outline-none transition-all text-gray-900 dark:text-white font-mono text-sm shadow-inner group-hover:shadow-md"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                >
                  <FaSearch className="text-xs" /> Go
                </button>
              </form>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to={backButtonInfo.path}
                className="w-full sm:w-auto px-8 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                <FaArrowLeft className="text-sm" /> {backButtonInfo.text}
              </Link>
              <Link
                to={explorePath}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                <FaSearch className="text-sm" /> Explore Properties
              </Link>
            </div>
          </div>

          {/* Sentinel Live Recommendations */}
          {!recsLoading && recommendations.length > 0 && (
            <div className="w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="relative overflow-hidden p-1 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 rounded-[2.5rem]">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-[2.4rem] border border-white/50 dark:border-gray-700/50 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <span className="p-2 bg-blue-600 text-white rounded-xl shadow-lg ring-4 ring-blue-50 dark:ring-blue-900/10">
                          {currentUser ? <FaRobot className="animate-pulse" /> : <FaRocket className="animate-bounce" />}
                        </span>
                        {currentUser ? "Sentinel Live" : "Alternative Matches"}
                      </h2>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full w-fit">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            {currentUser ? "SMART ALTERNATIVES BASED ON YOUR INTERESTS" : "HANDPICKED PROPERTIES FOR YOU"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link
                      to={explorePath}
                      className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black hover:text-blue-700 dark:hover:text-blue-300 transition-all group"
                    >
                      View All <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {recommendations.slice(0, visibleRecsCount).map((recListing) => (
                      <div key={`rec-${recListing._id}`} className="relative group overflow-visible">
                        {recListing.isLiveMatch && (
                          <div className="absolute -top-2 -right-2 z-20 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                            {Math.round(recListing.sentinelScore * 100)}% MATCH
                          </div>
                        )}
                        <ListingItem listing={recListing} />
                      </div>
                    ))}
                  </div>

                  {recommendations.length > visibleRecsCount && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => setVisibleRecsCount(prev => prev + 4)}
                        className="px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold rounded-xl shadow-lg border border-blue-100 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
                      >
                        View More Recommendations <FaArrowRight />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        url={seoUrl}
        image={seoImage}
        type="article"
        schema={listingSchema(listing)}
      />
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-950 dark:to-gray-900 min-h-screen py-10 px-2 md:px-8 transition-colors duration-300">
        <div className="max-w-4xl w-full mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-3 sm:p-6 relative overflow-x-hidden border border-transparent dark:border-gray-800 transition-colors duration-300">
          {listing.isDeleted && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FaTrash className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-red-800">
                    Property Not Available
                  </h3>
                  <div className="mt-1 text-sm text-red-700">
                    <p>
                      This property has been deleted and is no longer active on the platform.
                      {listing.deletionReason && (isAdmin || isOwnerMatch) && (
                        <span className="block mt-1 font-semibold">Reason: {listing.deletionReason}</span>
                      )}
                    </p>
                    {isAdmin && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ 
                          opacity: 1, 
                          y: 0,
                          scale: [1, 1.02, 1]
                        }}
                        transition={{
                          scale: {
                            repeat: Infinity,
                            duration: 3,
                            ease: "easeInOut"
                          }
                        }}
                        className="mt-3 flex items-center"
                      >
                        <Link
                          to="/admin/deleted-listings"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-black transition-all group border border-red-200 dark:border-red-900/50 shadow-sm hover:shadow-md hover:scale-[1.05] active:scale-95"
                        >
                          <FaUndo className="group-hover:-rotate-180 transition-transform duration-500 text-[10px]" />
                          <span>MISTAKENLY DELETED? RESTORE VIA ARCHIVE</span>
                        </Link>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header with Back Button and Actions */}
          <div className={`mb-6 ${listing.isDeleted ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* ... keeping the next line for context matching ... */}
            {/* Mobile layout: keep existing styling */}
            <div className="flex items-center justify-between flex-wrap gap-2 sm:hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate(backButtonInfo.path)}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-2 py-1 text-xs rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1"
                >
                  <FaArrowLeft /> {backButtonInfo.text}
                </button>
                <div className="relative">
                  <button
                    onClick={() => addToComparison(listing)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-2 py-1 text-xs rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1"
                  >
                    <FaChartLine /> + Compare
                  </button>
                  {showComparisonTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to use comparison tool
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
              {currentUser && !isAdminContext && isOwnerMatch && (
                <div className="flex items-center gap-2">
                  {listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract' ? (
                    <button
                      disabled
                      className="bg-gray-400 text-white px-3 py-2 text-sm rounded-lg cursor-not-allowed shadow-lg font-semibold flex items-center gap-2"
                      title={
                        listing.availabilityStatus === 'sold'
                          ? "Cannot edit sold property"
                          : listing.availabilityStatus === 'under_contract'
                            ? "Cannot edit property under contract"
                            : "Edit Disabled due to active Rent-Lock"
                      }
                    >
                      <FaLock /> {listing.availabilityStatus === 'sold' ? "Sold" : listing.availabilityStatus === 'under_contract' ? "Contract" : "Edit Locked"}
                    </button>
                  ) : (
                    <Link
                      to={`/user/update-listing/${listing._id}`}
                      className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-2 text-sm rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                    >
                      <FaEdit /> Edit Property
                    </Link>
                  )}
                  <button
                    onClick={(!listing.isRentLocked && listing.availabilityStatus !== 'sold' && listing.availabilityStatus !== 'under_contract') ? handleOwnerDeleteClick : undefined}
                    disabled={listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract'}
                    title={
                      listing.availabilityStatus === 'sold'
                        ? "Cannot delete sold property"
                        : listing.availabilityStatus === 'under_contract'
                          ? "Cannot delete property under contract"
                          : listing.isRentLocked
                            ? "Delete Disabled due to active Rent-Lock"
                            : "Delete Property"
                    }
                    className={`${listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract' ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'} text-white px-3 py-2 text-sm rounded-lg transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2`}
                  >
                    {(listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract') ? <FaLock /> : <FaTrash />}
                    {(listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract') ? "Locked" : "Delete"}
                  </button>
                </div>
              )}
              {isAdmin && isAdminContext && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/admin/update-listing/${listing._id}`}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-2 py-1 text-xs rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1"
                  >
                    <FaEdit /> <span className="hidden xs:inline">Edit Property</span>
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="bg-gradient-to-r from-red-500 to-red-600 text-white px-2 py-1 text-xs rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-1"
                  >
                    <FaTrash /> <span className="hidden xs:inline">Delete Property</span>
                  </button>
                </div>
              )}
            </div>

            {/* Desktop layout for users: Back, Compare, Edit (if owner) */}
            {!isAdminContext && (
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full mb-2">
                <button
                  onClick={() => navigate(backButtonInfo.path)}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                >
                  <FaArrowLeft className="text-sm" />
                  <span className="hidden sm:inline">{backButtonInfo.text}</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => addToComparison(listing)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                  >
                    <FaChartLine className="text-sm" />
                    <span className="hidden sm:inline">+ Compare</span>
                  </button>
                  {showComparisonTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to use comparison tool
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
                {isOwnerMatch && !listing.isDeleted ? (
                  (listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract') ? (
                    <button
                      disabled
                      className="bg-gray-400 text-white px-4 py-3 rounded-lg cursor-not-allowed shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                      title={
                        listing.availabilityStatus === 'sold'
                          ? "Cannot edit sold property"
                          : listing.availabilityStatus === 'under_contract'
                            ? "Cannot edit property under contract"
                            : "Edit Disabled due to active Rent-Lock"
                      }
                    >
                      <FaLock className="text-sm" />
                      <span className="hidden sm:inline">
                        {listing.availabilityStatus === 'sold' ? "Sold" : listing.availabilityStatus === 'under_contract' ? "Contract" : "Edit Locked"}
                      </span>
                    </button>
                  ) : (
                    <Link
                      to={`/user/update-listing/${listing._id}`}
                      className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                    >
                      <FaEdit className="text-sm" />
                      <span className="hidden sm:inline">Edit Property</span>
                    </Link>
                  )
                ) : (
                  <div className="hidden lg:block" />
                )}
                {isOwnerMatch && !listing.isDeleted ? (
                  <button
                    onClick={(!listing.isRentLocked && listing.availabilityStatus !== 'sold' && listing.availabilityStatus !== 'under_contract') ? handleOwnerDeleteClick : undefined}
                    disabled={listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract'}
                    title={
                      listing.availabilityStatus === 'sold'
                        ? "Cannot delete sold property"
                        : listing.availabilityStatus === 'under_contract'
                          ? "Cannot delete property under contract"
                          : listing.isRentLocked
                            ? "Delete Disabled due to active Rent-Lock"
                            : "Delete Property"
                    }
                    className={`${listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract' ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'} text-white px-4 py-3 rounded-lg transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base`}
                  >
                    {(listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract') ? <FaLock className="text-sm" /> : <FaTrash className="text-sm" />}
                    <span className="hidden sm:inline">
                      {(listing.isRentLocked || listing.availabilityStatus === 'sold' || listing.availabilityStatus === 'under_contract') ? "Locked" : "Delete Property"}
                    </span>
                  </button>
                ) : (
                  <div className="hidden lg:block" />
                )}
              </div>
            )}

            {/* Desktop layout for admins: 4 buttons grid like commit b1f11d7 */}
            {isAdmin && isAdminContext && (
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full">
                <button
                  onClick={() => navigate(backButtonInfo.path)}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                >
                  <FaArrowLeft className="text-sm" />
                  <span className="hidden sm:inline">{backButtonInfo.text}</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => addToComparison(listing)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                  >
                    <FaChartLine className="text-sm" />
                    <span className="hidden sm:inline">+ Compare</span>
                  </button>
                  {showComparisonTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to use comparison tool
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
                <Link
                  to={`/admin/update-listing/${listing._id}`}
                  className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                >
                  <FaEdit className="text-sm" />
                  <span className="hidden sm:inline">Edit Property</span>
                </Link>
                <button
                  onClick={handleDelete}
                  className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-3 rounded-lg hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2 text-center justify-center text-sm sm:text-base"
                >
                  <FaTrash className="text-sm" />
                  <span className="hidden sm:inline">Delete Property</span>
                </button>
              </div>
            )}
          </div>

          {/* Floating Comparison Panel - Redesigned */}
          {comparisonProperties.length > 0 && (
            <div className={`fixed bottom-0 right-0 sm:bottom-6 sm:right-6 transition-all duration-500 z-40 w-full sm:w-80 ${showComparisonPanel ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)] sm:translate-y-[calc(100%-4rem)]'}`}>
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border hover:border-purple-300 border-gray-200 dark:border-gray-700 shadow-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden transition-all duration-300">

                {/* Header / Toggle Bar */}
                <div
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 p-3 sm:p-4 cursor-pointer flex items-center justify-between"
                  onClick={() => setShowComparisonPanel(!showComparisonPanel)}
                >
                  <div className="flex items-center gap-2 text-white">
                    <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                      <FaChartLine className="text-sm sm:text-base animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base tracking-wide shadow-black drop-shadow-sm">Compare Properties</h3>
                      <p className="text-[10px] sm:text-xs text-indigo-100 font-medium">
                        {comparisonProperties.length} of 4 selected
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {showComparisonPanel ? <FaChevronDown className="text-white" /> : <FaChevronUp className="text-white" />}
                  </div>
                </div>

                {/* Content Area */}

                <div className="p-3 sm:p-4 bg-gradient-to-b from-white to-indigo-50/50 dark:from-gray-800 dark:to-gray-900">
                  <div className="space-y-2 mb-4 max-h-[40vh] sm:max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {comparisonProperties.map((property) => (
                      <div key={property._id} className="group flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded-xl shadow-sm border border-indigo-50 dark:border-gray-600 hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-500">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                            <AdvancedImage
                              src={property.imageUrls?.[0]}
                              alt={property.name}
                              className="w-full h-full object-cover rounded-lg shadow-sm"
                            />
                          </div>
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">{property.name}</p>
                            <p className="text-[10px] sm:text-xs text-indigo-500 font-medium truncate">
                              ₹{(property.offer ? property.discountPrice : property.regularPrice).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromComparison(property._id); }}
                          className="flex-shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          aria-label="Remove property"
                        >
                          <FaTimes size={12} />
                        </button>
                      </div>
                    ))}
                    {comparisonProperties.length < 4 && (
                      <button
                        onClick={openPropertySearch}
                        className="w-full py-3 border-2 border-dashed border-indigo-200 dark:border-gray-600 rounded-xl text-indigo-500 dark:text-indigo-400 text-xs sm:text-sm font-medium hover:bg-indigo-50 dark:hover:bg-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all flex items-center justify-center gap-2"
                      >
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1 rounded-full">
                          <FaSearch size={10} />
                        </div>
                        Add Property
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={() => setComparisonProperties([])}
                      className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      Clear
                    </button>
                    <button
                      onClick={openComparisonModal}
                      className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                    >
                      Compare
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
            Property Details {isAdmin && isAdminContext && "(Admin View)"}
          </h3>

          {/* Swiper Section */}
          <div className="relative mb-6 group">
            <Swiper
              navigation={{
                nextEl: '.swiper-button-next-custom',
                prevEl: '.swiper-button-prev-custom',
              }}
              modules={[Navigation]}
              className="rounded-lg overflow-hidden relative"
              onSlideChange={(swiper) => {
                // Update selected image index when swiper changes
                setSelectedImageIndex(swiper.activeIndex);
              }}
            >
              {/* Custom Navigation */}
              <div
                className={`swiper-button-prev-custom absolute top-1/2 left-4 z-20 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/60 text-white rounded-full items-center justify-center backdrop-blur-md cursor-pointer transition-all hover:scale-110 shadow-lg border border-white/10 ${selectedImageIndex === 0 ? 'hidden' : 'hidden md:flex'}`}
              >
                <FaChevronLeft size={22} />
              </div>
              <div
                className={`swiper-button-next-custom absolute top-1/2 right-4 z-20 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/60 text-white rounded-full items-center justify-center backdrop-blur-md cursor-pointer transition-all hover:scale-110 shadow-lg border border-white/10 ${selectedImageIndex === (listing.imageUrls?.length || 0) + (listing.videoUrls?.length || 0) - 1 ? 'hidden' : 'hidden md:flex'}`}
              >
                <FaChevronRight size={22} />
              </div>
              {(() => {
                const images = listing.imageUrls || [];
                const tourImages = listing.virtualTourImages || [];
                const videos = listing.videoUrls || [];
                const mediaItems = [
                  ...images.map((u, i) => ({ type: 'image', url: u, index: i, tour: false })),
                  // Exclude 360 images from main slider as requested
                  // ...tourImages.map((u, i) => ({ type: 'image', url: u, index: i, tour: true })),
                  ...videos.map((u, vi) => ({ type: 'video', url: u, vIndex: vi })),
                ];
                return mediaItems.length > 0 ? mediaItems.map((item, index) => (
                  <SwiperSlide key={index}>
                    <div className="relative group">
                      {item.type === 'image' ? (
                        <AdvancedImage
                          src={item.url}
                          alt={`${listing.name} - Image ${index + 1}`}
                          className="w-full h-40 sm:h-64 md:h-96 object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="relative w-full h-40 sm:h-64 md:h-96 bg-black overflow-hidden flex items-center justify-center">
                          <img
                            src={getVideoPoster(item.url) || "https://via.placeholder.com/800x600?text=Video+Tour"}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 opacity-80"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/800x600?text=Video+Preview";
                            }}
                          />
                          {/* Centered Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className={`backdrop-blur-md p-4 rounded-full border shadow-2xl transform transition-all group-hover:scale-110 ${showVideoPreview && selectedVideoIndex === item.vIndex ? 'bg-red-500/20 border-red-500/50' : 'bg-white/20 border-white/30'}`}>
                              <FaPlay className={`text-2xl sm:text-4xl drop-shadow-lg ${showVideoPreview && selectedVideoIndex === item.vIndex ? 'text-red-400 animate-pulse' : 'text-white'}`} />
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Media type and AI Room Label Badge */}
                      {item.type === 'image' && (
                        <div className="absolute top-4 right-4 z-30">
                          <span className="bg-black/70 backdrop-blur-md text-white text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-lg flex items-center gap-2 border border-white/20">
                            <FaRobot className="text-blue-400" />
                            {(() => {
                              const auditKey = item.tour ? `tour_${item.index}` : `main_${item.index}`;
                              const audit = listing.aiAuditResults && (listing.aiAuditResults[auditKey] || (listing.aiAuditResults.get && listing.aiAuditResults.get(auditKey)));
                              const caption = listing.imageCaptions && (listing.imageCaptions[item.index] || (listing.imageCaptions.get && listing.imageCaptions.get(String(item.index))));
                              return caption || audit?.suggestions?.[0] || 'Property Photo';
                            })()}
                          </span>
                        </div>
                      )}
                      {item.type === 'video' && (
                        <div className="absolute top-4 right-4 z-30">
                          <span className={`bg-black/70 backdrop-blur-md text-white text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-lg flex items-center gap-2 border ${showVideoPreview && selectedVideoIndex === item.vIndex ? 'border-red-500 ring-1 ring-red-500/50 animate-pulse' : 'border-white/20'}`}>
                            <FaPlay className={showVideoPreview && selectedVideoIndex === item.vIndex ? 'text-red-400' : 'text-red-500'} />
                            {showVideoPreview && selectedVideoIndex === item.vIndex ? 'Currently Playing' : 'Video Tour'}
                          </span>
                        </div>
                      )}

                      {/* Sale Status Overlays */}
                      {listing.availabilityStatus === 'under_contract' && (
                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-20 pointer-events-none">
                          <span className="bg-yellow-500 text-white px-6 py-3 font-bold text-lg sm:text-2xl rounded-lg transform -rotate-12 border-4 border-dashed border-white shadow-xl backdrop-blur-sm">
                            UNDER CONTRACT
                          </span>
                        </div>
                      )}

                      {listing.availabilityStatus === 'sold' && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 pointer-events-none">
                          <span className="bg-red-600 text-white px-8 py-4 font-extrabold text-xl sm:text-3xl rounded-lg transform -rotate-12 border-double border-8 border-white shadow-2xl">
                            SOLD
                          </span>
                        </div>
                      )}

                      {/* AI Audit Detailed Results Overlay */}
                      {item.type === 'image' && (
                        (() => {
                          const auditKey = item.tour ? `tour_${item.index}` : `main_${item.index}`;
                          const audit = listing.aiAuditResults && (listing.aiAuditResults[auditKey] || (listing.aiAuditResults.get && listing.aiAuditResults.get(auditKey)));
                          if (!audit) return null;

                          const caption = listing.imageCaptions && (listing.imageCaptions[item.index] || (listing.imageCaptions.get && listing.imageCaptions.get(String(item.index))));
                          const mainTag = caption || (audit.suggestions && audit.suggestions.length > 0 ? audit.suggestions[0] : null);
                          const quality = audit.quality || {};

                          return (
                            <div className="absolute bottom-4 left-4 z-40 pointer-events-none">
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col gap-2"
                              >


                                <div className="flex gap-2">
                                  {quality.brightness && quality.brightness === 'Good' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md backdrop-blur-md border border-green-400/30 bg-green-500/60 text-white text-[9px] sm:text-[10px] font-semibold shadow-lg">
                                      <FaCheckCircle className="text-[8px] sm:text-[10px]" />
                                      Good Light
                                    </div>
                                  )}
                                  {quality.contrast && quality.contrast === 'Good' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md backdrop-blur-md border border-indigo-400/30 bg-indigo-500/60 text-white text-[9px] sm:text-[10px] font-semibold shadow-lg">
                                      <FaCheckCircle className="text-[8px] sm:text-[10px]" />
                                      Clear Detail
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            </div>
                          );
                        })()
                      )}

                      {/* Dynamic action label */}
                      <div className="absolute bottom-4 right-4 z-30 transition-all duration-300 pointer-events-none">
                        <span className={`bg-black/70 backdrop-blur-md text-white text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-lg border flex items-center gap-2 ${item.type === 'video' && showVideoPreview && selectedVideoIndex === item.vIndex ? 'border-red-500 text-red-400' : 'border-white/20'}`}>
                          {item.type === 'image' ? (
                            <>
                              <FaExpand size={12} className="text-blue-400" />
                              Click to view
                            </>
                          ) : (
                            <>
                              <FaPlay size={12} className={showVideoPreview && selectedVideoIndex === item.vIndex ? 'text-red-400 animate-pulse' : 'text-red-500'} />
                              {showVideoPreview && selectedVideoIndex === item.vIndex ? 'Active Player' : 'Click to play'}
                            </>
                          )}
                        </span>
                      </div>

                      {/* Invisible clickable overlay */}
                      <button
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (item.type === 'image') {
                            handleImageClick(index);
                          } else {
                            setSelectedVideoIndex(item.vIndex || 0);
                            setShowVideoPreview(true);
                          }
                        }}
                        aria-label={`Expand image ${index + 1}`}
                      />
                    </div>
                  </SwiperSlide>
                )) : (
                  <SwiperSlide>
                    <div className="w-full h-64 md:h-96 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center transition-colors duration-300">
                      <div className="text-center text-gray-400 dark:text-gray-500">
                        <div className="text-6xl mb-4 opacity-80">🏠</div>
                        <p className="text-xs font-bold uppercase tracking-widest text-center opacity-70">No images available</p>
                      </div>
                    </div>
                  </SwiperSlide>
                )
              })()}
            </Swiper>
          </div>

          {/* Mobile Swipe Indicator */}
          <div className="md:hidden flex items-center justify-center gap-2 mb-4 text-gray-400 animate-pulse">
            <FaChevronLeft className="text-[10px]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Swipe to view more media</span>
            <FaChevronRight className="text-[10px]" />
          </div>

          {/* Share and Report Buttons */}
          <div className="flex justify-end items-center space-x-4 mb-4 pr-2">
            {/* Report Button - Only for logged-in users who are not the owner */}
            {currentUser && !isAdmin && !isOwnerMatch && (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:hover:text-red-300 px-3 py-2 rounded-lg transition-colors"
                title="Report this property"
              >
                <FaFlag className="text-sm" />
                <span className="text-sm font-medium">Report</span>
              </button>
            )}
            <button
              onClick={() => setShowSocialShare(true)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 dark:hover:text-blue-300 px-3 py-2 rounded-lg transition-colors"
              title="Share this property"
            >
              <FaShare className="text-sm" />
              <span className="text-sm font-medium">Share</span>
            </button>
            {/* AI Recommendations Button - Only for logged-in users */}
            {currentUser && (
              <button
                onClick={() => setShowAIRecommendations(true)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 dark:hover:text-blue-300 px-3 py-2 rounded-lg transition-colors"
                title="AI Property Recommendations"
              >
                <FaRobot className="text-sm" />
                <span className="text-sm font-medium">Advanced AI</span>
              </button>
            )}
          </div>
          {copied && (
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2">
                <FaCheckCircle className="text-sm" />
                <span className="text-sm font-medium">Link copied to clipboard!</span>
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="p-3 sm:p-6 bg-gray-50 dark:bg-gray-800 shadow-md rounded-lg mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-white break-words flex items-center gap-2">
                {listing.name}
                {listing.isVerified && (
                  <>
                    <button
                      onClick={() => setShowVerifiedModal(true)}
                      className="ml-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-green-200 transition-colors focus:outline-none"
                      title="Click to see whatVerified means"
                    >
                      <FaCheckCircle /> Verified Property
                    </button>
                    {(currentUser?.role === 'rootadmin' || currentUser?.role === 'admin') && (
                      <button
                        onClick={() => openConfirm('root-unpublish', { message: 'Unpublish this property?' })}
                        className="ml-3 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-red-200 transition-colors focus:outline-none"
                        title="Unpublish this property"
                      >
                        <FaBan /> Unpublish
                      </button>
                    )}
                  </>
                )}
                {/* Root Admin verification bypass button - ONLY for NOT verified */}
                {currentUser?.role === 'rootadmin' && !listing.isVerified && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmModal({
                        open: true,
                        type: 'root-verify',
                        message: 'Are you sure you want to BYPASS verification? This will instantly verify and publish this property, and notify the owner.'
                      });
                    }}
                    className="ml-3 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full text-xs sm:text-sm font-bold flex items-center gap-1 shadow-md hover:scale-105 transition-transform animate-pulse"
                    title="Root Admin Privilege: Instantly Verify & Publish"
                  >
                    <FaRocket className="text-xs" /> Root Verify
                  </button>
                )}
                {/* Wishlist Heart Icon - hide for admins */}
                {(!currentUser || (currentUser && !(currentUser.role === 'admin' || currentUser.role === 'rootadmin'))) && (
                  <div className="ml-2 relative inline-block">
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          showSignInPrompt('wishlist');
                          return;
                        }
                        if (isInWishlist(listing._id)) {
                          removeFromWishlist(listing._id);
                          setWishlistCount(prev => Math.max(0, prev - 1));
                        } else {
                          addToWishlist(listing);
                          setWishlistCount(prev => prev + 1);
                        }
                      }}
                      className={`p-2 rounded-full transition z-20 ${isInWishlist(listing._id) ? 'bg-red-500 text-white' : 'bg-gray-200 text-red-500 hover:text-red-600'} focus:outline-none`}
                      title={isInWishlist(listing._id) ? 'Remove from wishlist' : 'Add to wishlist'}
                      style={{ lineHeight: 0 }}
                    >
                      <FaHeart className="text-base sm:text-lg" />
                    </button>
                    {showWishlistTooltip && (
                      <div className="absolute bottom-full right-0 mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                        Please login to save properties
                        <div className="absolute top-full right-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Watchlist Eye Icon - for users only */}
                {currentUser && !(currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
                  <button
                    onClick={toggleWatchlist}
                    disabled={watchlistLoading}
                    className={`ml-2 p-2 rounded-full transition z-20 focus:outline-none ${isInWatchlist
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-blue-500 hover:text-blue-600 hover:bg-blue-100'
                      } ${watchlistLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                    style={{ lineHeight: 0 }}
                  >
                    {watchlistLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : (
                      <FaEye className="text-base sm:text-lg" />
                    )}
                  </button>
                )}
              </h1>
              {/* Offer Badge */}
              {listing.offer && getDiscountPercentage() > 0 && (
                <span
                  className="bg-yellow-400 text-gray-900 text-sm font-semibold px-4 py-1 rounded-full shadow-md animate-pulse w-max sm:w-auto ml-0 sm:ml-2 mt-2 sm:mt-0"
                  style={{ alignSelf: 'flex-start' }}
                  title="Limited-time offer!"
                >
                  {getDiscountPercentage()}% OFF
                </span>
              )}
            </div>

            {/* Price Display */}
            <div className="mb-4">
              {listing.offer && getDiscountPercentage() > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <p className="text-lg sm:text-2xl md:text-3xl text-blue-600 font-semibold">
                    {formatINR(listing.offer ? listing.discountPrice : listing.regularPrice)}
                    {listing.type === "rent" && " / month"}
                  </p>
                  <p className="text-base sm:text-xl text-gray-500 line-through">
                    {formatINR(listing.regularPrice)}
                  </p>
                  <span className="text-xs sm:text-sm text-green-600 font-semibold">
                    Save {formatINR(listing.regularPrice - listing.discountPrice)}
                  </span>
                </div>
              ) : (
                <p className="text-lg sm:text-2xl md:text-3xl text-blue-600 font-semibold">
                  {formatINR(listing.offer ? listing.discountPrice : listing.regularPrice)}
                  {listing.type === "rent" && " / month"}
                </p>
              )}
            </div>

            {/* Verification Warning Banner - For Property Owners Only */}
            {currentUser && listing.userRef && currentUser._id === listing.userRef && !listing.isVerified && (
              <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-yellow-800 mb-2">⚠️ Property Not Published</h3>
                    <p className="text-sm text-yellow-700 mb-3">
                      Your property is currently <strong>not visible to buyers</strong>. Complete the verification process to make it public and start receiving inquiries.
                    </p>
                    <Link
                      to={`/user/property-verification?listingId=${listing._id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-semibold hover:bg-yellow-700 transition-all transform hover:scale-105 shadow-md"
                    >
                      <FaShieldAlt /> Verify Property Now
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <p className="flex items-center text-gray-600 dark:text-gray-300 mb-4">
              <FaMapMarkerAlt className="mr-2 text-red-500" />
              {maskAddress(
                // Create address object if structured fields exist, otherwise use legacy address
                listing.propertyNumber || listing.city ? {
                  propertyNumber: listing.propertyNumber,
                  landmark: listing.landmark,
                  city: listing.city,
                  district: listing.district,
                  state: listing.state,
                  pincode: listing.pincode
                } : listing.address,
                !!currentUser
              )}
            </p>

            {listing.locationLink && shouldShowLocationLink(!!currentUser) && (
              <div className="mb-4">
                <a
                  href={listing.locationLink}
                  rel="noopener noreferrer"
                  className="inline-block bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg font-semibold"
                >
                  {getLocationLinkText(!!currentUser)}
                </a>
              </div>
            )}

            {listing.locationLink && !shouldShowLocationLink(!!currentUser) && (
              <div className="mb-4">
                <div className="inline-block relative">
                  <button
                    onClick={() => showSignInPrompt('location')}
                    className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg font-semibold"
                  >
                    {getLocationLinkText(!!currentUser)}
                  </button>
                  {showLocationTooltip && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                      Please login to view location
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`px-3 py-1 text-white rounded-md ${listing.type === "rent" ? "bg-blue-500" : "bg-green-500"}`}>
                {listing.type === "rent" ? "For Rent" : "For Sale"}
              </span>

              {/* Show verification status for admins and rootadmins */}
              {isAdmin && (
                <>
                  {listing.isVerified ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md flex items-center gap-1 font-semibold">
                      <FaCheckCircle className="text-green-600" />
                      Verified
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md flex items-center gap-1 font-semibold">
                      <FaExclamationTriangle className="text-yellow-600" />
                      Not Verified
                    </span>
                  )}
                </>
              )}
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
              <span className="font-semibold">Description:</span> {listing.description}
            </p>

            {/* VR / Drone / 360 Images media blocks if present */}
            {(listing.vrTourUrl || listing.droneVideoUrl || (listing.virtualTourImages && listing.virtualTourImages.length > 0)) && (
              <div className="space-y-6 mb-6">

                {/* 360° Images Section */}
                {/* 360° Virtual Tour Section */}

                {/* 1. Prompt for Unverified Owner */}
                {currentUser && currentUser._id === listing.userRef && !listing.isVerified && (
                  <div className="border border-dashed border-indigo-200 rounded-lg p-6 bg-indigo-50/50 text-center my-6 shadow-sm">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100">
                      <FaCompass className="text-indigo-600 text-3xl" />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2 text-lg">Unlock Immersive 360° Tours! 🔒</h4>
                    <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto leading-relaxed">
                      Get your property verified to enable 360° virtual tours. Verified listings with 360° views get up to <strong>3x more engagement</strong> and trust.
                    </p>
                    <button
                      onClick={() => navigate(`/user/property-verification?listingId=${listing._id}`)}
                      className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 transform hover:-translate-y-0.5"
                    >
                      Verify Property Now
                    </button>
                  </div>
                )}

                {/* 2. Viewer for Verified Listings */}
                {listing.isVerified && listing.virtualTourImages && listing.virtualTourImages.length > 0 && (
                  <div className="border rounded-lg p-3 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <h4 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        <FaCompass className="text-indigo-600 dark:text-indigo-400" /> 360° Virtual Tour ({listing.virtualTourImages.length})
                      </h4>
                      <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 rounded-full h-fit w-fit">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <FaRobot className="animate-pulse text-xs" /> Powered by Sentinel v2.0
                        </span>
                      </div>
                    </div>
                    {/* Main Active Viewer */}
                    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md group mb-4">
                      {/* 360 Viewer with conditional blur if not logged in */}
                      <div className={`w-full h-full ${!currentUser ? "filter blur-sm pointer-events-none select-none opacity-50" : ""}`}>
                        <VirtualTourViewer
                          imageUrl={listing.virtualTourImages[activeVirtualTourIndex]}
                          autoLoad={!!currentUser}
                          key={listing.virtualTourImages[activeVirtualTourIndex]} // Force re-mount on change
                        />
                      </div>

                      {/* AI Audit tags for 360 viewer */}
                      {currentUser && (
                        (() => {
                          const auditKey = `tour_${activeVirtualTourIndex}`;
                          const audit = listing.aiAuditResults && (listing.aiAuditResults[auditKey] || (listing.aiAuditResults.get && listing.aiAuditResults.get(auditKey)));
                          if (!audit) return null;

                          const mainTag = audit.suggestions && audit.suggestions.length > 0 ? audit.suggestions[0] : null;
                          const quality = audit.quality || {};

                          return (
                            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                              <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex flex-col gap-2"
                              >
                                {mainTag && (
                                  <div className="flex items-center gap-2 bg-indigo-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg shadow-2xl border border-white/20 w-fit">
                                    <FaRobot className="text-xs animate-bounce text-blue-300" />
                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                                      AI Deteced: {mainTag}
                                    </span>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  {quality.brightness && quality.brightness === 'Good' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md backdrop-blur-md border border-green-400/30 bg-green-500/60 text-white text-[9px] sm:text-[10px] font-semibold shadow-lg">
                                      <FaCheckCircle className="text-[8px] sm:text-[10px]" />
                                      Pano Light: Good
                                    </div>
                                  )}
                                  {quality.contrast && quality.contrast === 'Good' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md backdrop-blur-md border border-indigo-400/30 bg-indigo-500/60 text-white text-[9px] sm:text-[10px] font-semibold shadow-lg">
                                      <FaCheckCircle className="text-[8px] sm:text-[10px]" />
                                      Pano Clarity: High
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            </div>
                          );
                        })()
                      )}

                      {/* Login Overlay for non-logged in users */}
                      {!currentUser && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/10">
                          <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-xl text-center transform transition-transform border border-white/20">
                            <div className="bg-indigo-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                              <FaLock className="text-indigo-600 w-5 h-5" />
                            </div>
                            <h5 className="text-gray-900 font-bold text-base mb-1">Restricted View</h5>
                            <p className="text-gray-500 text-xs mb-4 max-w-[200px] mx-auto leading-relaxed">
                              Login to explore this property in immersive 360° detail.
                            </p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`);
                              }}
                              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2 w-full"
                            >
                              <span>Sign In to Unlock</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Thumbnails Slider if > 1 image */}
                    {listing.virtualTourImages.length > 1 && (
                      <div className="relative">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
                          {listing.virtualTourImages.map((imgUrl, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveVirtualTourIndex(idx)}
                              className={`flex-shrink-0 relative w-24 h-16 rounded-lg overflow-hidden border-2 transition-all snap-start ${activeVirtualTourIndex === idx
                                ? 'border-indigo-600 ring-2 ring-indigo-100 scale-105'
                                : 'border-gray-200 opacity-70 hover:opacity-100 hover:border-indigo-300'
                                }`}
                            >
                              <img
                                src={imgUrl}
                                alt={`View ${idx + 1}`}
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                              />
                              <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-tl-md backdrop-blur-sm">
                                {idx + 1}
                              </div>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">Select a scene to explore</p>
                      </div>
                    )}
                  </div>
                )}

                {listing.vrTourUrl && (
                  <div className="border rounded-lg p-3 bg-white">
                    <h4 className="font-semibold text-gray-800 mb-2">Virtual Tour (External)</h4>
                    <iframe src={listing.vrTourUrl} title="VR Tour" className="w-full h-64 rounded" allowFullScreen />
                  </div>
                )}
                {listing.droneVideoUrl && (
                  <div className="border rounded-lg p-3 bg-white">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center justify-between">
                      Drone View
                      {showDronePreview && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse border border-red-200">
                          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" /> Active
                        </span>
                      )}
                    </h4>
                    <div className="relative w-full h-64 rounded bg-black group cursor-pointer overflow-hidden" onClick={() => setShowDronePreview(true)}>
                      <video src={listing.droneVideoUrl} className="w-full h-full object-cover opacity-80" muted playsInline />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                        <FaPlay className="text-white text-4xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow-lg" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-gray-700 dark:text-gray-300">
              <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <FaBed className="mr-2 text-blue-500" /> {listing.bedrooms} {listing.bedrooms > 1 ? "beds" : "bed"}
              </div>
              <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <FaBath className="mr-2 text-blue-500" /> {listing.bathrooms} {listing.bathrooms > 1 ? "baths" : "bath"}
              </div>
              <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <FaParking className="mr-2 text-blue-500" /> {listing.parking ? "Parking" : "No Parking"}
              </div>
              <div className="flex items-center p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <FaChair className="mr-2 text-blue-500" /> {listing.furnished ? "Furnished" : "Unfurnished"}
              </div>
            </div>

            {/* Enhanced Property Features */}
            <div className="mt-6 space-y-4">
              {/* Property Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm text-center">
                  <FaRuler className="mx-auto text-green-600 mb-1" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">Area</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {listing.area ? `${listing.area} sq ft` : 'Not specified'}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm text-center">
                  <FaBuilding className="mx-auto text-purple-600 mb-1" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">Floor</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {listing.floor !== undefined && listing.floor !== null && listing.floor !== '' ?
                      (listing.floor == 0 ? 'Ground Floor' : `Floor ${listing.floor}`) :
                      'Not specified'
                    }
                  </p>
                </div>
                {/* View Count - Only show for admins, rootadmins, and property owners */}
                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin' || (listing.userRef && currentUser._id === listing.userRef)) && (
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm text-center">
                    <FaEye className="mx-auto text-blue-600 mb-1" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">Views</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {listing.viewCount || 0}
                    </p>
                  </div>
                )}
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm text-center">
                  <FaCalendarAlt className="mx-auto text-orange-600 mb-1" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">Age</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {listing.propertyAge ? `${listing.propertyAge} years` : 'Not specified'}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm text-center">
                  <FaHeart className="mx-auto text-red-500 mb-1" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">Wishlisted</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {wishlistCount} {wishlistCount === 1 ? 'user' : 'users'}
                  </p>
                </div>
              </div>

              {/* Interactive Feature Toggles */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <button
                  onClick={() => setShowAmenities(!showAmenities)}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <FaHome />
                  <span className="text-sm font-medium">Amenities</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        showSignInPrompt('nearby');
                        return;
                      }
                      setShowNearbyPlaces(!showNearbyPlaces);
                    }}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white p-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 w-full"
                  >
                    <FaMapMarkerAlt />
                    <span className="text-sm font-medium">Nearby</span>
                  </button>
                  {showNearbyTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to view nearby places
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        showSignInPrompt('priceAnalysis');
                        return;
                      }
                      setShowPriceAnalysis(!showPriceAnalysis);
                    }}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 w-full"
                  >
                    <FaChartLine />
                    <span className="text-sm font-medium">Price Analysis</span>
                  </button>
                  {showPriceAnalysisTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to view price analysis
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        showSignInPrompt('insights');
                        return;
                      }
                      setShowContactInfo(!showContactInfo);
                    }}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 w-full"
                  >
                    <FaChartLine />
                    <span className="text-sm font-medium">Insights</span>
                  </button>
                  {showInsightsTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to view insights
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        showSignInPrompt('smartPriceInsights');
                        return;
                      }
                      setShowSmartPriceInsights(!showSmartPriceInsights);
                    }}
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 w-full"
                  >
                    <FaRocket />
                    <span className="text-sm font-medium">Smart Insights</span>
                  </button>
                  {showSmartPriceInsightsTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to view smart price insights
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        showSignInPrompt('virtualStaging');
                        return;
                      }
                      setShowVirtualStaging(!showVirtualStaging);
                    }}
                    className="bg-gradient-to-r from-pink-500 to-rose-600 text-white p-3 rounded-lg hover:from-pink-600 hover:to-rose-700 transition-all flex items-center justify-center gap-2 w-full"
                  >
                    <FaChair />
                    <span className="text-sm font-medium">AI Staging</span>
                  </button>
                  {showVirtualStagingTooltip && (
                    <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                      Please login to use AI Staging
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Virtual Staging Section */}
          {showVirtualStaging && currentUser && (
            <div className="mb-6 animate-fade-in-up">
              <VirtualStagingTool listingImages={listing.imageUrls || []} originalImage={listing.imageUrls?.[0]} />
            </div>
          )}

          {/* Amenities Section */}
          {showAmenities && (
            <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
              <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaHome className="text-blue-600" />
                Property Amenities
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {getAmenities().map((amenity, index) => (
                  <div key={index} className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className={`mr-3 ${amenity.color}`}>{amenity.icon}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{amenity.name}</span>
                  </div>
                ))}
                {getAmenities().length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-4">
                    No specific amenities listed
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nearby Places Section */}
          {showNearbyPlaces && currentUser && (
            <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
              <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaMapMarkerAlt className="text-green-600" />
                Nearby Places
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getNearbyPlaces().map((place, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <div className="flex items-center">
                      <span className="mr-3 text-blue-600">{place.icon}</span>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">{place.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{place.count} {place.count === '1' ? 'place' : 'places'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 capitalize">{place.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-green-600">{place.distance}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">away</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price Analysis Section */}
          {showPriceAnalysis && currentUser && (
            <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
              <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaChartLine className="text-purple-600" />
                Price Analysis
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h5 className="font-semibold text-blue-800 dark:text-blue-100 mb-2">Current Price</h5>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                      {formatINR(listing.offer ? listing.discountPrice : listing.regularPrice)}
                      {listing.type === "rent" && " / month"}
                    </p>
                    {listing.offer && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Save {formatINR(listing.regularPrice - listing.discountPrice)} ({getDiscountPercentage()}% off)
                      </p>
                    )}
                  </div>

                  {listing.type === "sale" && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-green-800 dark:text-green-100">EMI Calculator</h5>
                        <button
                          onClick={() => setShowCalculatorModal(true)}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-full transition-colors"
                          title="Open EMI Calculator"
                        >
                          <FaCalculator className="text-lg" />
                        </button>
                      </div>
                      <p className="text-lg font-bold text-green-600 dark:text-green-300">
                        ₹{calculateEMI(listing.offer ? listing.discountPrice : listing.regularPrice).toLocaleString('en-IN')} / month
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">@ 8.5% for 20 years</p>
                    </div>
                  )}

                  {/* Investment Tools Link - Only for logged-in users */}
                  {currentUser && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-blue-800 dark:text-blue-100">Investment Tools</h5>
                        <Link
                          to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/investment-tools' : '/user/investment-tools'}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors"
                          title="Open Investment Tools"
                        >
                          <FaChartLine className="text-lg" />
                        </Link>
                      </div>
                      <p className="text-sm text-blue-600 dark:text-blue-300 mb-2">
                        Advanced ROI, Mortgage, Portfolio & Risk Analysis Tools
                      </p>
                      <Link
                        to={currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin/investment-tools' : '/user/investment-tools'}
                        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm font-medium transition-colors"
                      >
                        <FaCalculator className="text-xs" />
                        Open Investment Tools
                      </Link>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h5 className="font-semibold text-gray-800 dark:text-white mb-2">Price per sq ft</h5>
                    <p className="text-xl font-bold text-gray-700 dark:text-gray-200">
                      ₹{listing.area ? Math.round((listing.offer ? listing.discountPrice : listing.regularPrice) / listing.area).toLocaleString('en-IN') : 'N/A'} / sq ft
                    </p>
                  </div>

                  {neighborhood && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                      <h5 className="font-semibold text-yellow-800 dark:text-yellow-100 mb-2">Area Average</h5>
                      <p className="text-lg font-bold text-yellow-600 dark:text-yellow-300">
                        ₹{neighborhood.averagePriceNearby?.toLocaleString('en-IN') || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Average price in {neighborhood.city}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Property Insights Section */}
          {showContactInfo && currentUser && (
            <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
              <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FaChartLine className="text-orange-600" />
                Property Insights & Analytics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50">
                    <h5 className="font-semibold text-blue-800 dark:text-blue-100 mb-2 flex items-center gap-2">
                      <FaEye className="text-blue-600 dark:text-blue-400" />
                      Property Performance
                    </h5>
                    <div className="space-y-2">
                      {/* Total Views - Only show for admins, rootadmins, and property owners */}
                      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin' || (listing.userRef && currentUser._id === listing.userRef)) && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Total Views</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-300">
                            {listing.viewCount || 0}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Days Listed</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-300">
                          {daysListed > 0 ? `${daysListed} days` : 'Today'}
                        </span>
                      </div>
                      {/* Interest Level - Only show for admins, rootadmins, and property owners */}
                      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin' || (listing.userRef && currentUser._id === listing.userRef)) && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Interest Level</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {(() => {
                              const views = listing.viewCount || 0;
                              return views > 100 ? 'High' : views > 50 ? 'Medium' : 'Low';
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-4 rounded-lg border border-green-100 dark:border-green-800/50">
                    <h5 className="font-semibold text-green-800 dark:text-green-100 mb-2 flex items-center gap-2">
                      <FaThumbsUp className="text-green-600 dark:text-green-400" />
                      Market Position
                    </h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Price Competitiveness</span>
                        <span className="font-semibold text-green-600 dark:text-green-300">
                          {neighborhood && neighborhood.averagePriceNearby ?
                            (listing.regularPrice < neighborhood.averagePriceNearby ? 'Below Market' : 'Above Market') :
                            'Market Rate'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Property Type</span>
                        <span className="font-semibold text-green-600 dark:text-green-300">{listing.type === 'rent' ? 'Rental' : 'Sale'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Demand Score</span>
                        <span className="font-semibold text-green-600 dark:text-green-300">
                          {listing.bedrooms >= 3 ? 'High' : listing.bedrooms === 2 ? 'Medium' : 'Standard'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-4 rounded-lg border border-purple-100 dark:border-purple-800/50">
                    <h5 className="font-semibold text-purple-800 dark:text-purple-100 mb-2 flex items-center gap-2">
                      <FaComments className="text-purple-600 dark:text-purple-400" />
                      Community Feedback
                    </h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Average Rating</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-300">
                          {listing.averageRating > 0 ? `${listing.averageRating.toFixed(1)} ⭐` : 'No ratings yet'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Total Reviews</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-300">{listing.reviewCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Owner Response Rate</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-300">85%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 p-4 rounded-lg border border-orange-100 dark:border-orange-800/50">
                    <h5 className="font-semibold text-orange-800 dark:text-orange-100 mb-2 flex items-center gap-2">
                      <FaCalculator className="text-orange-600 dark:text-orange-400" />
                      Investment Analysis
                    </h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">ROI Potential</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-300">
                          {listing.type === 'rent' ? '5-8%' : '8-12%'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Appreciation Rate</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-300">6-10% annually</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Risk Level</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-300">Low-Medium</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Smart Price Insights Section */}
          {showSmartPriceInsights && currentUser && (
            <EnhancedSmartPriceInsights listing={listing} currentUser={currentUser} />
          )}

          {/* AI Rent Prediction & Locality Score (for rental properties) */}
          {listing.type === "rent" && (
            <>
              <div className="flex justify-center gap-4 mt-8 flex-wrap">
                <div className="relative">
                  <button
                    onClick={async () => {
                      if (!currentUser) {
                        showSignInPrompt('rentPrediction');
                        return;
                      }
                      if (!showRentPrediction && !rentPrediction) {
                        setPredictionLoading(true);
                        try {
                          const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/predictions/${listing._id}`);
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setRentPrediction(data.prediction);
                          } else if (res.status === 404 || !data.prediction) {
                            // Prediction doesn't exist, offer to generate
                            if (currentUser) {
                              const generateRes = await authenticatedFetch(`${API_BASE_URL}/api/rental/predictions/${listing._id}`, {
                                method: 'POST'
                              });
                              const generateData = await generateRes.json();
                              if (generateRes.ok && generateData.success) {
                                setRentPrediction(generateData.prediction);
                              }
                            }
                          }
                        } catch (error) {
                          console.error('Error fetching prediction:', error);
                        } finally {
                          setPredictionLoading(false);
                        }
                      }
                      setShowRentPrediction((prev) => !prev);
                    }}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-2 rounded-lg shadow font-semibold flex items-center gap-2 hover:from-blue-600 hover:to-indigo-700 transition-all"
                  >
                    {predictionLoading ? 'Loading...' : showRentPrediction ? 'Hide Rent Prediction' : 'Show AI Rent Prediction'}
                  </button>
                  {showRentPredictionTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                      Please login to view AI rent predictions
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={async () => {
                      if (!currentUser) {
                        showSignInPrompt('localityScore');
                        return;
                      }
                      if (!showLocalityScore && !localityScore) {
                        setLocalityLoading(true);
                        try {
                          const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/locality-score/${listing._id}`);
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setLocalityScore(data.localityScore);
                          }
                        } catch (error) {
                          console.error('Error fetching locality score:', error);
                        } finally {
                          setLocalityLoading(false);
                        }
                      }
                      setShowLocalityScore((prev) => !prev);
                    }}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-lg shadow font-semibold flex items-center gap-2 hover:from-green-600 hover:to-emerald-700 transition-all"
                  >
                    {localityLoading ? 'Loading...' : showLocalityScore ? 'Hide Locality Score' : 'Show Locality Score'}
                  </button>
                  {showLocalityScoreTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                      Please login to view locality scores
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 transform rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rent Prediction Display */}
              {showRentPrediction && (
                <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <RentPredictionDisplay
                      prediction={rentPrediction}
                      loading={predictionLoading}
                      onGenerate={async () => {
                        if (!currentUser) {
                          showSignInPrompt('rentPrediction');
                          return;
                        }
                        setPredictionLoading(true);
                        try {
                          const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/predictions/${listing._id}`, {
                            method: 'POST'
                          });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setRentPrediction(data.prediction);
                            toast.success('Rent prediction generated successfully');
                          } else {
                            toast.error(data.message || 'Failed to generate prediction');
                          }
                        } catch (error) {
                          console.error('Error generating prediction:', error);
                          toast.error('Failed to generate prediction');
                        } finally {
                          setPredictionLoading(false);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Locality Score Display */}
              {showLocalityScore && (
                <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <LocalityScoreDisplay
                      localityScore={localityScore}
                      loading={localityLoading}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ESG Information Section */}
          {listing.esg ? (
            <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6 relative">
              {showEsgTooltip && (
                <div className="absolute -top-3 right-4 -translate-y-full bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                  Please login to expand ESG insights
                  <div className="absolute top-full right-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                </div>
              )}
              <ESGDisplay
                esg={listing.esg}
                isAuthenticated={!!currentUser}
                onAuthRequired={() => showSignInPrompt('esg')}
              />
            </div>
          ) : (
            <div className="p-6 bg-gray-50 dark:bg-gray-800 shadow-md rounded-lg mb-6">
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg mb-2">🌱 ESG Information</div>
                <div className="text-gray-400">No ESG data available for this property</div>
                <div className="text-sm text-gray-400 mt-2">
                  ESG (Environmental, Social, Governance) information helps assess the sustainability of this property.
                </div>
              </div>
            </div>
          )}



          {/* Admin Information - Only show for admins */}
          {isAdmin && isAdminContext && (
            <>
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 shadow-md rounded-lg mb-6">
                <h4 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-4">Admin Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Property ID</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{listing._id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Created Date</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {new Date(listing.createdAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {new Date(listing.updatedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Created By</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {typeof listing.userRef === 'object' ? (listing.userRef.username || listing.userRef._id) : (listing.userRef || 'Unknown')}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Watchlist Count</p>
                      <button onClick={refreshWatchlistCount} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">Refresh</button>
                    </div>
                    <p className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                      <FaEye className="text-sm" />
                      {watchlistCount} user{watchlistCount !== 1 ? 's' : ''} watching
                    </p>
                  </div>
                </div>
              </div>
              {/* Property Owner Details Section */}
              <div className="p-6 bg-green-50 dark:bg-green-900/20 shadow-md rounded-lg mb-6">
                <h4 className="text-xl font-bold text-green-800 dark:text-green-300 mb-4">Property Owner Details</h4>
                {ownerLoading ? (
                  <p className="text-gray-500 dark:text-gray-400">Loading owner details...</p>
                ) : ownerDetails && ownerStatus.isActive ? (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Owner Name</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{ownerDetails.username}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Owner Email</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{ownerDetails.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Mobile Number</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{ownerDetails.mobileNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Owner ID</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{ownerDetails._id}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="mt-4 flex flex-col gap-3">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-blue-700 text-sm font-medium">
                            ℹ️ Owner account is active and accessible.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={openDeassignOwnerModal}
                            className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors flex items-center gap-2"
                          >
                            <FaBan /> Deassign Owner
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : ownerError ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="text-red-500">{ownerError}</p>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          fetchAvailableUsers();
                          setShowAssignOwnerModal(true);
                        }}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                      >
                        <FaEdit /> Assign New Owner
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">No owner details found.</p>
                )}
              </div>
            </>
          )}

          {/* Additional Details - Only show for owner of this property (non-admin context) */}
          {isOwnerMatch && !(isAdmin && isAdminContext) && (
            <div className="p-6 bg-gray-50 dark:bg-gray-800 shadow-md rounded-lg mb-6">
              <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Additional Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Created Date</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {new Date(listing.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {new Date(listing.updatedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Find Agent Section */}
          <div className="mt-8 mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-blue-100 dark:border-gray-600 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white dark:bg-gray-600 p-3 rounded-full shadow-sm">
                <FaUserTie className="text-2xl text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                  {currentUser ? (isAdmin ? "Manage Agents" : "Not sure about this property?") : "Need professional help?"}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {currentUser
                    ? (isAdmin ? "Access the agent management dashboard." : "Talk to a local agent for expert guidance.")
                    : "Sign in to connect with verified local agents."}
                </p>
              </div>
            </div>

            {currentUser ? (
              <Link
                to={isAdmin ? "/admin/agents" : "/user/agents"}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2"
              >
                {isAdmin ? "Manage Agents" : "Find an Agent"} <FaArrowLeft className="rotate-180" />
              </Link>
            ) : (
              <Link
                to={`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2"
              >
                Sign In to Find Agent <FaArrowLeft className="rotate-180" />
              </Link>
            )}
          </div>

          {listing && isListingUnavailable && (
            <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start mb-6">
              <FaLock className="text-amber-600 text-xl mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">
                  {listing.availabilityStatus === 'under_contract'
                    ? (listing.type === 'rent' ? 'Under Rent-Lock Review' : 'Under Sale-Lock Review')
                    : availabilityLabel}
                </p>
                <p className="text-sm text-amber-800">
                  {listing.availabilityStatus === 'under_contract'
                    ? (listing.type === 'rent'
                      ? 'A rent-lock contract is currently being processed for this property.'
                      : 'A sale transaction for this property is currently being finalized.')
                    : availabilityMessage}
                </p>
                {availabilityLockedAt && (
                  (isAdmin ||
                    (currentUser && (listing.sellerId === currentUser._id || listing.userRef === currentUser._id)) ||
                    (currentUser && listing.availabilityMeta?.lockedBy === currentUser._id) ||
                    userActiveContract) && (
                    <p className="text-xs text-amber-600 mt-2">
                      Locked since {new Date(availabilityLockedAt).toLocaleString()}
                    </p>
                  ))}
              </div>
            </div>
          )}

          {/* Rent Property / Book Appointment Buttons */}
          <div className="flex justify-center gap-4 flex-wrap">
            {currentUser && listing && (listing.sellerId === currentUser._id || listing.userRef === currentUser._id) ? (
              <div className="text-red-500 font-semibold text-lg py-3">You cannot book an appointment or rent your own property.</div>
            ) : isListingUnavailable ? (
              <div className="text-amber-800 font-semibold text-center py-3 max-w-2xl">
                Booking and rent actions are temporarily disabled until the current deal is resolved.
              </div>
            ) : (
              <>
                {/* Rent Property Button (only for rental properties) */}
                {listing?.type === "rent" && (
                  <div className="relative">
                    <button
                      onClick={async () => {
                        if (!currentUser) {
                          showSignInPrompt('rent');
                          return;
                        }

                        try {
                          const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts`);

                          if (res.ok) {
                            const data = await res.json();
                            if (data.contracts && data.contracts.length > 0) {
                              const pendingContract = data.contracts.find(
                                c => (c.status === 'pending_signature' || c.status === 'draft') &&
                                  (c.listingId?._id === listing._id || c.listingId === listing._id) &&
                                  (c.tenantId?._id === currentUser._id || c.tenantId === currentUser._id)
                              );

                              if (pendingContract) {
                                toast.info('You have a pending contract. Resuming from where you left off.');
                                navigate(`/user/rent-property?listingId=${listing._id}&contractId=${pendingContract.contractId || pendingContract._id}`);
                                return;
                              }
                            }
                          }
                        } catch (error) {
                          console.error('Error checking pending contracts:', error);
                        }

                        navigate(`/user/rent-property?listingId=${listing._id}`);
                      }}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                    >
                      <FaLock className="inline" /> Rent This Property
                    </button>
                    {showRentTooltip && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                        Please login to rent this property
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                )}
                {/* Book Appointment Button */}
                {listing?.type !== "rent" && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          showSignInPrompt('appointment');
                          return;
                        }
                        const appointmentUrl = isAdminContext
                          ? `/admin/appointmentlisting?listingId=${listing._id}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}&listingType=${listing.type}`
                          : `/user/appointment?listingId=${listing._id}&propertyName=${encodeURIComponent(listing.name)}&propertyDescription=${encodeURIComponent(listing.description)}&listingType=${listing.type}`;
                        navigate(appointmentUrl);
                      }}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
                    >
                      📅 Book Appointment
                    </button>
                    {showBookAppointmentTooltip && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-600 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                        Please login to book appointments
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Neighborhood Insights */}
          {currentUser && neighborhood && (
            <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700">
              <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Neighborhood Insights</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">City</p>
                  <p className="font-semibold text-gray-800 dark:text-white">{neighborhood.city}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Average Price Nearby</p>
                  <p className="font-semibold text-gray-800 dark:text-white">₹{(neighborhood.averagePriceNearby || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">School Score</p>
                  <p className="font-semibold text-gray-800 dark:text-white">{neighborhood.schoolScore}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Safety Score</p>
                  <p className="font-semibold text-gray-800 dark:text-white">{neighborhood.safetyScore}</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-gray-600 dark:text-gray-400">Commute Times</p>
                <p className="font-semibold text-gray-800 dark:text-white">Metro: {neighborhood.commuteTimes?.metro}, Bus: {neighborhood.commuteTimes?.bus}, Car: {neighborhood.commuteTimes?.car}</p>
              </div>
              <div className="mt-3">
                <p className="text-gray-600 dark:text-gray-400">Nearby Amenities</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(neighborhood.nearbyAmenities || []).map((a, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Similar Properties Section */}
          {currentUser && similarProperties.length > 0 && (
            <div className="mt-8 p-8 bg-white dark:bg-gray-800 shadow-xl rounded-[2.5rem] mb-8 border border-gray-100 dark:border-gray-700/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h4 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <FaHome className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-4xl" />
                    Similar Properties in {listing.city}
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">Discover other handpicked properties matching your lifestyle in this area</p>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-100 dark:border-indigo-800/50 shadow-sm transition-all hover:scale-105 active:scale-95 group cursor-pointer h-fit w-fit self-start">
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:rotate-12 transition-transform">
                    <FaRobot className="animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] leading-none mb-0.5">Neural Engine</span>
                    <span className="text-sm font-black text-gray-900 dark:text-white leading-none">Powered by Sentinel v2.0</span>
                  </div>
                </div>
              </div>
              {loadingSimilar ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
                      <div className="flex gap-2">
                        <div className="flex-1 h-10 bg-gray-200 rounded"></div>
                        <div className="h-10 w-24 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {similarProperties.map((property) => (
                    <div key={property._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white dark:bg-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h5 className="font-semibold text-gray-800 dark:text-white truncate">{property.name}</h5>
                          {property.isVerified && property.type === 'rent' && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap">
                              <FaCheckCircle className="text-[10px]" /> Verified
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${property.type === 'rent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {property.type === 'rent' ? 'Rent' : 'Sale'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{property.city}, {property.state}</p>
                      <p className="text-lg font-bold text-blue-600 mb-2">
                        {formatINR(property.offer ? property.discountPrice : property.regularPrice)}
                        {property.type === "rent" && " / month"}
                      </p>
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                        <span>{property.bedrooms} bed • {property.bathrooms} bath</span>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          to={`/listing/${property._id}`}
                          className="flex-1 bg-blue-600 text-white text-center py-2 px-3 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          View Details
                        </Link>
                        <div className="relative">
                          <button
                            onClick={() => {
                              if (!currentUser) {
                                showSignInPrompt('comparison');
                                return;
                              }
                              addPropertyFromSearch(property);
                            }}
                            className="bg-purple-600 text-white py-2 px-3 rounded text-sm hover:bg-purple-700 transition-colors"
                          >
                            + Compare
                          </button>
                          {showComparisonTooltip && (
                            <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                              Please login to use comparison tool
                              <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reviews / Ratings Toggle Buttons */}
          {listing.type === 'rent' ? (
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              {renderReviewsToggleButton()}
              {renderRentalRatingsToggleButton()}
            </div>
          ) : (
            <div className="flex justify-center mt-8">
              {renderReviewsToggleButton()}
            </div>
          )}
          {/* Reviews Section (collapsible) */}
          {showReviews && currentUser && (
            <div className="mt-8">
              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                    <FaStar className="text-yellow-500 mr-2" />
                    Reviews
                    {listing.averageRating > 0 && (
                      <span className="ml-2 text-lg text-gray-600">
                        ({listing.averageRating.toFixed(1)} ⭐ • {listing.reviewCount} review{listing.reviewCount !== 1 ? 's' : ''})
                      </span>
                    )}
                  </h3>
                </div>
                {/* Review Form */}
                <ReviewForm
                  listingId={listing._id}
                  onReviewSubmitted={() => {
                    // Refresh the listing data to update rating
                    window.location.reload();
                  }}
                />
                {/* Review List */}
                <ReviewList
                  listingId={listing._id}
                  onReviewDeleted={() => {
                    // Refresh the listing data to update rating
                    window.location.reload();
                  }}
                  listingOwnerId={listing.userRef}
                />
              </div>
            </div>
          )}

          {/* Rental Ratings Section (for rental properties) */}
          {listing.type === "rent" && showPropertyRatings && propertyRatings && (
            <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center mb-4">
                  <FaStar className="text-blue-500 mr-2" />
                  Rental Ratings
                </h3>
                {propertyRatings.statistics && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total Ratings</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{propertyRatings.statistics.totalRatings}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <p className="text-sm text-green-700 dark:text-green-300 mb-1">Landlord Ratings</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {propertyRatings.statistics.landlordRatings || 0}
                      </p>
                      {propertyRatings.statistics.averageLandlordRating && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Avg: {propertyRatings.statistics.averageLandlordRating.toFixed(1)} ⭐
                        </p>
                      )}
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Tenant Ratings</p>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                        {propertyRatings.statistics.tenantRatings || 0}
                      </p>
                      {propertyRatings.statistics.averageTenantRating && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          Avg: {propertyRatings.statistics.averageTenantRating.toFixed(1)} ⭐
                        </p>
                      )}
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">Overall Average</p>
                      <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                        {propertyRatings.statistics.overallAverage?.toFixed(1) || '0.0'} ⭐
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {propertyRatings.detailedRatings && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Tenant Feedback Highlights</h4>
                    {propertyRatings.detailedRatings.tenantHighlights?.length > 0 ? (
                      <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        {propertyRatings.detailedRatings.tenantHighlights.map((highlight, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No tenant highlights available.</p>
                    )}
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Landlord Feedback Highlights</h4>
                    {propertyRatings.detailedRatings.landlordHighlights?.length > 0 ? (
                      <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        {propertyRatings.detailedRatings.landlordHighlights.map((highlight, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-purple-500">•</span>
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No landlord highlights available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FAQ Section */}
          {faqs.length > 0 && (
            <div className="mt-12">
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center mb-6">
                  <FaQuestionCircle className="text-blue-500 mr-3" />
                  Property FAQs
                </h3>
                <div className="space-y-4">
                  {faqLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading FAQs...</p>
                    </div>
                  ) : (
                    faqs.map((faq) => (
                      <div
                        key={faq._id}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <button
                          onClick={() => setExpandedFAQ(expandedFAQ === faq._id ? null : faq._id)}
                          className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
                              {faq.question}
                            </h4>
                            <motion.div
                              animate={{ rotate: expandedFAQ === faq._id ? 180 : 0 }}
                              transition={{ duration: 0.3 }}
                              className="flex-shrink-0"
                            >
                              <FaChevronDown className="text-gray-400" />
                            </motion.div>
                          </div>
                        </button>
                        <AnimatePresence>
                          {expandedFAQ === faq._id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="pt-4">
                                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                    {faq.answer}
                                  </p>

                                  {/* FAQ Rating Section */}
                                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Was this helpful?</span>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => handleFAQReaction(faq._id, 'like')}
                                        disabled={!!faqReactionLoading[faq._id]}
                                        className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200 border text-sm font-medium ${userFAQReactions[faq._id] === 'like'
                                          ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800'
                                          : 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800'
                                          } ${faqReactionLoading[faq._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        {userFAQReactions[faq._id] === 'like' ? <FaThumbsUp /> : <FaRegThumbsUp />}
                                        <span>
                                          {faqReactionLoading[faq._id] === 'like' ? 'Updating...' : 'Yes'} ({faq.helpful || 0})
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => handleFAQReaction(faq._id, 'dislike')}
                                        disabled={!!faqReactionLoading[faq._id]}
                                        className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200 border text-sm font-medium ${userFAQReactions[faq._id] === 'dislike'
                                          ? 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-800'
                                          : 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800'
                                          } ${faqReactionLoading[faq._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        {userFAQReactions[faq._id] === 'dislike' ? <FaThumbsDown /> : <FaRegThumbsDown />}
                                        <span>
                                          {faqReactionLoading[faq._id] === 'dislike' ? 'Updating...' : 'No'}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Related Blogs Section */}
          {relatedBlogs.length > 0 && (
            <div className="mt-12">
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center mb-6">
                  <FaBookOpen className="text-green-500 mr-3" />
                  Related Articles
                </h3>
                {blogLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Loading articles...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {relatedBlogs.map((blog) => (
                      <article
                        key={blog._id}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {blog.thumbnail && (
                          <div className="aspect-w-16 aspect-h-9">
                            <img
                              src={blog.thumbnail}
                              alt={blog.title}
                              className="w-full h-48 object-cover"
                            />
                          </div>
                        )}
                        <div className="p-6">
                          <div className="mb-3">
                            <span className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                              {blog.category}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 line-clamp-2">
                            <Link
                              to={`/${blog.type === 'guide' ? 'guide' : 'blog'}/${blog.slug || blog._id}`}
                              className="hover:text-green-600 transition-colors"
                            >
                              {blog.title}
                            </Link>
                          </h4>
                          <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                            {blog.excerpt || blog.content.slice(0, 120) + '...'}
                          </p>
                          {blog.tags && blog.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-4">
                              {blog.tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  <FaTag className="mr-1" />
                                  {tag}
                                </span>
                              ))}
                              {blog.tags.length > 3 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  +{blog.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-col space-y-2 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              <FaUser />
                              <span>{blog.author?.username || 'UrbanSetu Team'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1">
                                <FaCalendar />
                                <span>{new Date(blog.publishedAt || blog.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                  <FaEye />
                                  <span>{blog.views || 0}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <FaHeart />
                                  <span>{blog.likes || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4">
                            <Link
                              to={isAdmin ? (blog.type === 'guide' ? `/admin/guide/${blog.slug || blog._id}` : `/admin/blog/${blog.slug || blog._id}`) : (blog.type === 'guide' ? `/guide/${blog.slug || blog._id}` : `/blog/${blog.slug || blog._id}`)}
                              className="inline-flex items-center text-green-600 hover:text-green-700 font-medium text-sm"
                            >
                              Read More
                              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Links Section */}
          <div className="mt-12">
            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center mb-6">
                <FaCompass className="text-purple-500 mr-3" />
                Explore More
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  to={isAdmin ? "/admin/blogs" : currentUser ? "/user/blogs" : "/blogs"}
                  className="bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center transition-colors group"
                >
                  <FaBookOpen className="text-blue-600 dark:text-blue-400 text-2xl mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Real Estate Blog</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{isAdmin ? "Manage blog posts" : "Read latest insights and tips"}</p>
                </Link>
                <Link
                  to={isAdmin ? "/admin/faqs" : currentUser ? "/user/faqs" : "/faqs"}
                  className="bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 text-center transition-colors group"
                >
                  <FaQuestionCircle className="text-orange-600 dark:text-orange-400 text-2xl mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">FAQs</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{isAdmin ? "Manage FAQ content" : "Find answers to common questions"}</p>
                </Link>
                <Link
                  to={isAdmin ? "/admin/about" : currentUser ? "/user/about" : "/about"}
                  className="bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center transition-colors group"
                >
                  <FaInfoCircle className="text-green-600 dark:text-green-400 text-2xl mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">About UrbanSetu</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{isAdmin ? "Manage about page content" : "Learn more about our platform"}</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ContactSupportWrapper />
      {/* Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <form onSubmit={handleReasonSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4 border border-transparent dark:border-gray-700">
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaTrash /> Reason for Deletion</h3>
            <textarea
              className="border rounded p-2 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter reason for deleting this property"
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              rows={3}
              autoFocus
            />
            {deleteError && <div className="text-red-600 text-sm">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowReasonModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-red-600 text-white font-semibold">Next</button>
            </div>
          </form>
        </div>
      )}
      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <form onSubmit={handlePasswordSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4 border border-transparent dark:border-gray-700">
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaLock /> Confirm Password</h3>
            <input
              type="password"
              className="border rounded p-2 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              autoFocus
            />
            {deleteError && <div className="text-red-600 text-sm">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Confirm & Delete'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Image Preview Modal */}
      {listing && listing.imageUrls && listing.imageUrls.length > 0 && (
        <ImagePreview
          isOpen={showImagePreview}
          onClose={() => setShowImagePreview(false)}
          images={listing.imageUrls}
          initialIndex={selectedImageIndex}
          listingId={listing._id}
          metadata={{
            addedFrom: 'listing',
            listingName: listing.name,
            listingType: listing.type
          }}
        />
      )}

      {/* Video Preview Modal */}
      {listing && listing.videoUrls && listing.videoUrls.length > 0 && (
        <VideoPreview
          isOpen={showVideoPreview}
          onClose={() => setShowVideoPreview(false)}
          videos={listing.videoUrls}
          initialIndex={selectedVideoIndex}
          listingId={listing._id}
        />
      )}

      {/* Drone Video Preview Modal */}
      {listing && listing.droneVideoUrl && (
        <VideoPreview
          isOpen={showDronePreview}
          onClose={() => setShowDronePreview(false)}
          videos={[listing.droneVideoUrl]}
          initialIndex={0}
          listingId={listing._id}
        />
      )}

      {/* Report Property Modal */}
      {showReportModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md flex flex-col gap-4 border border-transparent dark:border-gray-700">
            <h3 className="text-lg font-bold text-red-700 dark:text-red-500 flex items-center gap-2">
              <FaFlag /> Report Property
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Help us maintain quality by reporting any issues with this property.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Report Category *</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                >
                  <option value="">Select a category</option>
                  <option value="fake">Fake / misleading listing</option>
                  <option value="wrong_info">Wrong information</option>
                  <option value="inappropriate">Inappropriate images/content</option>
                  <option value="scam">Scam / suspicious activity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {(reportCategory === 'other' || reportCategory) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {reportCategory === 'other' ? 'Additional Details *' : 'Additional Details (Optional)'}
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    rows={4}
                    placeholder={reportCategory === 'other' ? 'Please provide details about the issue...' : 'Provide additional context (optional)...'}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportCategory('');
                  setReportDetails('');
                }}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleReportProperty}
                disabled={reportLoading || !reportCategory || (reportCategory === 'other' && !reportDetails.trim())}
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {reportLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Reporting...
                  </>
                ) : (
                  <>
                    <FaFlag className="text-sm" />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Deassign Owner Modal */}
      {showDeassignModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md border border-transparent dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-red-700 dark:text-red-500 flex items-center gap-2">
                <FaBan /> Remove Property Owner
              </h3>

            </div>
            <form onSubmit={handleDeassignOwnerSubmit} className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This note will be shared with the previous owner via email. Please be clear and professional.
              </p>
              <textarea
                value={deassignReason}
                onChange={(e) => setDeassignReason(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Example: Owner unresponsive to tenant support despite repeated reminders."
                disabled={deassignLoading}
              />
              {deassignError && <p className="text-sm text-red-600">{deassignError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeassignModal(false)}
                  className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
                  disabled={deassignLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deassignLoading || !deassignReason.trim()}
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deassignLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Removing...
                    </>
                  ) : (
                    <>
                      <FaBan /> Confirm Deassign
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Booking Chat Wrapper */}
      {listing && (
        <PreBookingChatWrapper
          listingId={listing._id}
          ownerId={listing.userRef}
          listingTitle={listing.name}
        />
      )}

      {/* Verified Property Modal */}
      <VerifiedModal
        isOpen={showVerifiedModal}
        onClose={() => setShowVerifiedModal(false)}
      />

      {/* Assign New Owner Modal */}
      {showAssignOwnerModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md flex flex-col gap-4 border border-transparent dark:border-gray-800">
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaEdit /> Assign New Owner</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Select a user to assign as the new owner of this property.</p>
            <input
              type="text"
              value={assignUserSearch}
              onChange={(e) => {
                const value = e.target.value;
                // Limit to 10 digits for mobile numbers, but allow longer for names/emails
                const isNumeric = /^\d+$/.test(value.replace(/[\s\-\(\)\+]/g, ''));
                if (isNumeric && value.replace(/[\s\-\(\)\+]/g, '').length > 10) {
                  return; // Don't update if numeric input exceeds 10 digits
                }
                setAssignUserSearch(value);
              }}
              placeholder="Search users by name, email, or mobile number (max 10 digits)"
              className="border rounded p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
              disabled={assignOwnerLoading}
            />
            <select
              className="border rounded p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
              value={selectedNewOwner}
              onChange={(e) => setSelectedNewOwner(e.target.value)}
              disabled={assignOwnerLoading}
            >
              <option value="">Select a user</option>
              {availableUsers
                .filter((user) => {
                  const q = assignUserSearch.trim().toLowerCase();
                  if (!q) return true;

                  const name = (user.username || user.name || "").toLowerCase();
                  const email = (user.email || "").toLowerCase();
                  const mobileRaw = (user.mobileNumber || user.mobile || "").toString();
                  const mobile = mobileRaw.replace(/\D/g, '');

                  // If query is exactly a 10-digit number, require exact mobile match
                  if (/^\d{10}$/.test(q)) {
                    return mobile === q;
                  }

                  // Otherwise broad matching across fields
                  return (
                    name.includes(q) ||
                    email.includes(q) ||
                    mobileRaw.toLowerCase().includes(q)
                  );
                })
                .map((user) => {
                  // Format mobile number for display
                  const formatMobileNumber = (mobile) => {
                    if (!mobile) return '';
                    const cleanMobile = mobile.toString().replace(/[\s\-\(\)]/g, '');
                    if (cleanMobile.length === 10) {
                      return `+91-${cleanMobile}`;
                    } else if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
                      return `+${cleanMobile}`;
                    } else if (cleanMobile.length === 13 && cleanMobile.startsWith('+91')) {
                      return cleanMobile;
                    }
                    return mobile;
                  };

                  const displayName = user.username || user.name || user.email;
                  const displayEmail = user.email;
                  const displayMobile = formatMobileNumber(user.mobileNumber || user.mobile);

                  return (
                    <option key={user._id} value={user._id}>
                      {displayName} ({displayEmail}{displayMobile ? `, ${displayMobile}` : ''})
                    </option>
                  );
                })}
            </select>
            {assignOwnerLoading && <p className="text-gray-500">Assigning new owner...</p>}
            {selectedNewOwner && !assignOwnerLoading && (
              <button
                onClick={handleAssignNewOwner}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
              >
                <FaCheckCircle /> Confirm Assignment
              </button>
            )}
            <button
              onClick={() => setShowAssignOwnerModal(false)}
              className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* EMI Calculator Modal */}
      {showCalculatorModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-transparent dark:border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                <FaCalculator /> EMI Calculator
              </h3>
              <button
                onClick={() => setShowCalculatorModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <FaTimes className="text-lg" />
              </button>
            </div>

            <EMICalculator
              propertyPrice={listing.offer ? listing.discountPrice : listing.regularPrice}
              propertyName={listing.name}
            />
          </div>
        </div>
      )}

      {/* Advanced Property Comparison Modal - Redesigned */}
      {showComparisonModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-7xl w-full mx-auto h-[90vh] sm:h-[95vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-4 sm:p-5 shadow-lg z-20 sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-md rounded-xl shadow-inner">
                    <FaChartLine className="text-xl sm:text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Compare Properties</h2>
                    <p className="text-indigo-100 text-xs sm:text-sm font-medium hidden sm:block opacity-90">
                      Analyzing {comparisonProperties.length} properties side-by-side
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="bg-white/20 backdrop-blur-md rounded-lg px-3 py-1 text-xs sm:text-sm font-semibold border border-white/10">
                    {comparisonProperties.length}/4 Selected
                  </div>
                  {comparisonProperties.length < 4 && (
                    <button
                      onClick={() => {
                        setShowComparisonModal(false);
                        setShowPropertySearch(true);
                      }}
                      className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm"
                    >
                      <FaSearch className="text-xs" /> Add More
                    </button>
                  )}
                  <button
                    onClick={() => setShowComparisonModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors active:scale-95"
                    aria-label="Close Comparison"
                  >
                    <FaTimes className="text-lg sm:text-xl" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 custom-scrollbar">
              <div className="p-2 sm:p-6 min-h-full">
                {comparisonProperties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600">
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                      <FaChartLine className="text-4xl text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">No Properties Selected</h3>
                    <p className="text-gray-500 mb-6 max-w-md">Add properties to compare their features, prices, and amenities side by side.</p>
                    <button
                      onClick={() => {
                        setShowComparisonModal(false);
                        setShowPropertySearch(true);
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center gap-2"
                    >
                      <FaSearch /> Find Properties
                    </button>
                  </div>
                ) : (
                  /* Detailed Comparison Table Container */
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                    <div className="overflow-x-auto pb-2">
                      <table className="w-full text-sm min-w-[800px] border-collapse">
                        <thead>
                          <tr className="bg-gray-50/80 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <th className="px-4 py-4 sm:px-6 sm:py-5 text-left text-gray-600 dark:text-gray-300 font-bold uppercase text-xs tracking-wider w-1/5 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Feature</th>
                            {comparisonProperties.map((property) => (
                              <th key={property._id} className="px-4 py-4 sm:px-6 sm:py-5 text-left w-[20%] min-w-[200px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors relative group">
                                <div className="space-y-3">
                                  <div className="relative aspect-video rounded-lg overflow-hidden shadow-sm">
                                    <img
                                      src={property.imageUrls?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'}
                                      alt={property.name}
                                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'; }}
                                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute top-2 right-2">
                                      <button
                                        onClick={() => openConfirm('remove-one', { propertyId: property._id, message: 'Remove this property from comparison?' })}
                                        className="bg-white/90 dark:bg-gray-700/90 hover:bg-red-50 dark:hover:bg-red-900/50 text-gray-500 dark:text-gray-300 hover:text-red-600 p-1.5 rounded-full shadow-sm transition-all"
                                        title="Remove"
                                      >
                                        <FaTimes size={10} />
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <Link to={`/listing/${property._id}`} className="block text-gray-900 dark:text-white font-bold text-sm sm:text-base hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1 mb-1" title={property.name}>
                                      {property.name}
                                    </Link>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {property.isVerified && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                          <FaCheckCircle size={8} /> Verified
                                        </span>
                                      )}
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${property.type === 'rent' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {property.type === 'rent' ? 'Rent' : 'Sale'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </th>
                            ))}
                            {/* Empty columns filter filler */}
                            {[...Array(4 - comparisonProperties.length)].map((_, i) => (
                              <th key={`empty-${i}`} className="px-4 py-4 sm:px-6 sm:py-5 w-[20%] bg-gray-50/30 dark:bg-gray-800/30">
                                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl h-full min-h-[160px] flex flex-col items-center justify-center gap-2 p-4 text-gray-400">
                                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-full">
                                    <FaHome className="text-xl opacity-30" />
                                  </div>
                                  <span className="text-xs font-medium">Add Property</span>
                                  <button
                                    onClick={() => {
                                      setShowComparisonModal(false);
                                      setShowPropertySearch(true);
                                    }}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-semibold transition-all shadow-sm"
                                  >
                                    + Add
                                  </button>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {/* Price Row */}
                          <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-900 transition-colors">
                            <td className="px-4 py-4 sm:px-6 sm:py-5 font-bold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-2"><FaTag className="text-indigo-500" /> Price</div>
                            </td>
                            {comparisonProperties.map(property => {
                              const price = property.offer ? property.discountPrice : property.regularPrice;
                              const isLowest = comparisonProperties.every(p => (p.offer ? p.discountPrice : p.regularPrice) >= price);

                              return (
                                <td key={property._id} className={`px-4 py-4 sm:px-6 sm:py-5 align-top ${isLowest ? 'bg-green-50/30 dark:bg-green-900/20' : ''}`}>
                                  <div className="space-y-1">
                                    <span className="block text-lg font-bold text-gray-900 dark:text-white">
                                      ₹{price.toLocaleString('en-IN')}{property.type === 'rent' && <span className="text-xs text-gray-500 font-normal">/mo</span>}
                                    </span>
                                    {isLowest && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full animate-pulse-slow">
                                        ⭐ Best Value
                                      </span>
                                    )}
                                    {property.offer && (
                                      <span className="block text-xs text-green-600 font-medium">
                                        {Math.round(((property.regularPrice - property.discountPrice) / property.regularPrice) * 100)}% OFF
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            {[...Array(4 - comparisonProperties.length)].map((_, i) => <td key={i} className="bg-gray-50/10"></td>)}
                          </tr>

                          {/* Location & Area Row */}
                          <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-900 transition-colors">
                            <td className="px-4 py-4 sm:px-6 sm:py-5 font-bold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-2"><FaMapMarkerAlt className="text-red-500" /> Location & Size</div>
                            </td>
                            {comparisonProperties.map(property => (
                              <td key={property._id} className="px-4 py-4 sm:px-6 sm:py-5 align-top text-sm">
                                <div className="space-y-2 text-gray-600 dark:text-gray-400">
                                  <p className="flex items-start gap-1.5">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 min-w-[60px]">City:</span> {property.city}
                                  </p>
                                  <p className="flex items-start gap-1.5">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 min-w-[60px]">Area:</span> {property.area ? `${property.area} sq ft` : 'N/A'}
                                  </p>
                                  <p className="flex items-start gap-1.5">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 min-w-[60px]">BHK:</span> {property.bhk} BHK
                                  </p>
                                </div>
                              </td>
                            ))}
                            {[...Array(4 - comparisonProperties.length)].map((_, i) => <td key={i} className="bg-gray-50/10"></td>)}
                          </tr>

                          {/* Key Amenities Row */}
                          <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-900 transition-colors">
                            <td className="px-4 py-4 sm:px-6 sm:py-5 font-bold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-2"><FaCheckCircle className="text-green-500" /> Amenities</div>
                            </td>
                            {comparisonProperties.map(property => {
                              const amenities = [
                                { icon: <FaParking />, label: 'Parking', value: property.parking },
                                { icon: <FaChair />, label: 'Furnished', value: property.furnished },
                                { icon: <FaTree />, label: 'Garden', value: property.garden },
                                { icon: <FaWifi />, label: 'WiFi', value: property.wifi },
                                { icon: <FaSwimmingPool />, label: 'Pool', value: property.swimmingPool },
                                { icon: <FaShieldAlt />, label: 'Security', value: property.security },
                              ].filter(a => a.value);

                              return (
                                <td key={property._id} className="px-4 py-4 sm:px-6 sm:py-5 align-top">
                                  <div className="flex flex-wrap gap-2">
                                    {amenities.length > 0 ? amenities.map((a, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-[10px] sm:text-xs font-semibold rounded-md border border-gray-200 dark:border-gray-600" title={a.label}>
                                        {a.icon} {a.label}
                                      </span>
                                    )) : <span className="text-xs text-gray-400 italic">No key amenities</span>}
                                    <span className="text-[10px] text-gray-400 self-center">+{amenities.length > 6 ? amenities.length - 6 : 0} more</span>
                                  </div>
                                </td>
                              );
                            })}
                            {[...Array(4 - comparisonProperties.length)].map((_, i) => <td key={i} className="bg-gray-50/10"></td>)}
                          </tr>

                          {/* Ratings Row */}
                          <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-900 transition-colors">
                            <td className="px-4 py-4 sm:px-6 sm:py-5 font-bold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-gray-700">
                              <div className="flex items-center gap-2"><FaStar className="text-yellow-400" /> Ratings</div>
                            </td>
                            {comparisonProperties.map(property => (
                              <td key={property._id} className="px-4 py-4 sm:px-6 sm:py-5 align-top text-sm">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="flex text-yellow-400 text-sm">
                                    {[...Array(5)].map((_, i) => (
                                      <FaStar key={i} className={i < Math.round(property.averageRating || 0) ? "fill-current" : "text-gray-200"} />
                                    ))}
                                  </div>
                                  <span className="font-bold text-gray-700 dark:text-gray-200">{property.averageRating?.toFixed(1) || '0.0'}</span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{property.reviewCount || 0} reviews</p>
                              </td>
                            ))}
                            {[...Array(4 - comparisonProperties.length)].map((_, i) => <td key={i} className="bg-gray-50/10"></td>)}
                          </tr>

                          {/* Action Row */}
                          <tr>
                            <td className="px-4 py-4 sm:px-6 sm:py-5 font-bold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-gray-700">
                              Action
                            </td>
                            {comparisonProperties.map(property => (
                              <td key={property._id} className="px-4 py-4 sm:px-6 sm:py-5 align-top">
                                <Link
                                  to={`/listing/${property._id}`}
                                  className="block w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:shadow-indigo-200 mb-2"
                                >
                                  View Details
                                </Link>
                                <button
                                  onClick={() => {
                                    setSelectedComparisonProperty(property);
                                    setShowComparisonSocialShare(true);
                                  }}
                                  className="block w-full text-center px-4 py-2 bg-white border border-gray-200 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 text-sm font-semibold rounded-xl transition-all"
                                >
                                  Share
                                </button>
                              </td>
                            ))}
                            {[...Array(4 - comparisonProperties.length)].map((_, i) => <td key={i} className="bg-gray-50/10"></td>)}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 sticky bottom-0 z-20 shadow-[-1px_-5px_20px_rgba(0,0,0,0.05)]">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => openConfirm('clear-all', { origin: 'comparison', message: 'Clear all compared properties? You can add new ones next.' })}
                  className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-semibold transition-colors"
                  disabled={comparisonProperties.length === 0}
                >
                  <FaTrash /> Clear Comparison
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowComparisonModal(false)}
                    className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-semibold transition-colors"
                  >
                    Keep Browsing
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Advanced Property Search Modal - Redesigned */}
      {showPropertySearch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full mx-4 h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-4 sm:p-5 shadow-lg z-20 sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-md rounded-xl shadow-inner">
                    <FaSearch className="text-xl sm:text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Add Properties</h2>
                    <p className="text-indigo-100 text-xs sm:text-sm font-medium opacity-90">Search and select properties to compare</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-md rounded-lg px-3 py-1 text-xs sm:text-sm font-semibold border border-white/10">
                    {comparisonProperties.length}/4 Selected
                  </div>
                  <button
                    onClick={() => {
                      setShowPropertySearch(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors active:scale-95"
                    aria-label="Close Search"
                  >
                    <FaTimes className="text-xl" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 custom-scrollbar">
              <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full">
                {/* Advanced Search Input */}
                <div className="mb-8 relative z-10">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FaSearch className="text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, location, type, BHK..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-12 py-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/50 focus:border-indigo-500 transition-all text-base sm:text-lg shadow-sm placeholder-gray-400 bg-white dark:bg-gray-800 dark:text-white"
                      autoFocus
                    />
                    {searchLoading && (
                      <div className="absolute right-4 top-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                    {searchQuery && !searchLoading && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>

                  {/* Search Suggestions */}
                  {!searchQuery.trim() && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-2 py-1">Try Search:</span>
                      {['Ocean Breeze', '3 BHK', 'Downtown', 'Villa', 'Under 50k'].map(tag => (
                        <button
                          key={tag}
                          onClick={() => setSearchQuery(tag)}
                          className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full text-xs font-medium transition-all shadow-sm hover:shadow-md"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Enhanced Search Results */}
                <div className="space-y-6">
                  {searchResults.length > 0 ? (
                    <div className="animate-fade-in-up">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                          <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">{searchResults.length}</span>
                          Results Found
                        </h3>
                        <div className="text-sm text-gray-500">
                          for "{searchQuery}"
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {searchResults.map((property) => {
                          const isAlreadyAdded = comparisonProperties.some(p => p._id === property._id);
                          const canAdd = !isAlreadyAdded && comparisonProperties.length < 4;

                          return (
                            <div key={property._id} className={`bg-white dark:bg-gray-800 border rounded-2xl p-4 sm:p-5 transition-all duration-300 relative overflow-hidden group ${isAlreadyAdded ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:shadow-xl'}`}>
                              <div className="flex gap-4 sm:gap-5">
                                <div className="relative w-24 sm:w-32 aspect-square flex-shrink-0">
                                  <img
                                    src={property.imageUrls?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'}
                                    alt={property.name}
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'; }}
                                    className="w-full h-full object-cover rounded-xl shadow-md transform group-hover:scale-105 transition-transform duration-500"
                                  />
                                  {property.offer && (
                                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-md font-bold shadow-sm">
                                      -{(Math.round(((property.regularPrice - property.discountPrice) / property.regularPrice) * 100))}%
                                    </div>
                                  )}
                                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                                    <FaStar className="inline text-yellow-400 mr-0.5" />{property.averageRating?.toFixed(1) || 'N/A'}
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-start justify-between mb-1">
                                      <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg line-clamp-1 group-hover:text-indigo-600 transition-colors" title={property.name}>{property.name}</h3>
                                      {property.isVerified && (
                                        <FaCheckCircle className="text-green-500 flex-shrink-0 mt-1" title="Verified" />
                                      )}
                                    </div>

                                    <p className="text-gray-500 text-xs sm:text-sm mb-3 flex items-center gap-1">
                                      <FaMapMarkerAlt className="text-gray-300" /> {property.city}, {property.state}
                                    </p>

                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                      <span className={`px-2.5 py-1 text-xs rounded-lg font-bold ${property.type === 'rent' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800'}`}>
                                        {property.type === 'rent' ? 'Rent' : 'Sale'}
                                      </span>
                                      <span className="px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-600 rounded-lg font-medium">
                                        {property.bhk} BHK
                                      </span>
                                      {property.furnished && (
                                        <span className="px-2.5 py-1 text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800 rounded-lg font-medium hidden sm:inline-block">
                                          Furnished
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-end justify-between gap-2 mt-2">
                                    <div>
                                      <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                                        ₹{(property.offer ? property.discountPrice : property.regularPrice).toLocaleString('en-IN')}
                                        {property.type === 'rent' && <span className="text-xs text-gray-500 font-normal">/mo</span>}
                                      </div>
                                    </div>

                                    <div className="flex gap-2">
                                      <Link
                                        to={`/listing/${property._id}`}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="View Details"
                                      >
                                        <FaExpand />
                                      </Link>
                                      <button
                                        onClick={() => addPropertyFromSearch(property)}
                                        disabled={!canAdd || isAlreadyAdded}
                                        className={`px-4 py-2 text-sm rounded-xl font-bold transition-all shadow-sm ${isAlreadyAdded
                                          ? 'bg-green-100 text-green-700 cursor-default'
                                          : canAdd
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300 active:scale-95'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                          }`}
                                      >
                                        {isAlreadyAdded ? <span className="flex items-center gap-1"><FaCheckCircle /> Added</span> : 'Add'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  ) : searchQuery.trim() ? (
                    <div className="text-center py-20 flex flex-col items-center justify-center">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-4 border border-gray-100 dark:border-gray-700 shadow-inner">
                        <FaSearch className="text-4xl text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">No Matching Properties</h3>
                      <p className="text-gray-500 mb-6 max-w-xs mx-auto">We couldn't find any properties matching "{searchQuery}". Try different keywords.</p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-indigo-600 font-semibold hover:text-indigo-800 hover:underline"
                      >
                        Clear Search
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-16 sm:py-24">
                      <div className="relative mb-8 inline-block">
                        <div className="absolute inset-0 bg-blue-200 rounded-full blur-xl opacity-20 animate-pulse"></div>
                        <div className="bg-gradient-to-br from-white to-blue-50 rounded-3xl p-6 shadow-xl border border-blue-100 relative z-10 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                          <FaChartLine className="text-5xl text-indigo-500" />
                          <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-lg shadow-lg border border-gray-100">
                            <FaSearch className="text-lg text-violet-500" />
                          </div>
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">Begin Comparison</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
                        Search for properties to add to your comparison list. Compare prices, amenities, and ratings side-by-side.
                      </p>
                    </div>
                  )}

                  {/* Enhanced Similar Properties Section */}
                  {currentUser && similarProperties.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-gray-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                          <FaChartLine />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Recommendations for You</h3>
                      </div>


                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {similarProperties.map((property) => {
                          const isAlreadyAdded = comparisonProperties.some(p => p._id === property._id);
                          const canAdd = !isAlreadyAdded && comparisonProperties.length < 4;

                          return (
                            <div key={property._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-300 hover:border-blue-300">
                              <div className="flex gap-3">
                                <img
                                  src={property.imageUrls?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'}
                                  alt={property.name}
                                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'; }}
                                  className="w-16 h-16 object-cover rounded-lg shadow-sm"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1">{property.name}</h4>
                                    {property.isVerified && property.type === 'rent' && (
                                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-semibold flex items-center gap-0.5 whitespace-nowrap">
                                        <FaCheckCircle className="text-[9px]" /> Verified
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-600 text-xs mb-2">{property.city}, {property.state}</p>

                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${property.type === 'rent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                      }`}>
                                      {property.type}
                                    </span>
                                    <span className="text-xs text-gray-500">{property.bhk} BHK</span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-bold text-green-600 text-sm">
                                        ₹{(property.offer ? property.discountPrice : property.regularPrice).toLocaleString('en-IN')}
                                      </p>
                                      {property.offer && (
                                        <p className="text-xs text-gray-500 line-through">
                                          ₹{property.regularPrice.toLocaleString('en-IN')}
                                        </p>
                                      )}
                                    </div>

                                    <div className="relative">
                                      <button
                                        onClick={() => {
                                          if (!currentUser) {
                                            showSignInPrompt('comparison');
                                            return;
                                          }
                                          addPropertyFromSearch(property);
                                        }}
                                        disabled={!canAdd}
                                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${isAlreadyAdded
                                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                          : canAdd
                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                          }`}
                                      >
                                        {isAlreadyAdded ? 'Added' : canAdd ? 'Add' : 'Max'}
                                      </button>
                                      {showComparisonTooltip && (
                                        <div className="absolute top-full left-0 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap z-50">
                                          Please login to use comparison tool
                                          <div className="absolute -top-1 left-4 w-2 h-2 bg-red-600 transform rotate-45"></div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Footer Actions */}
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 rounded-xl p-4 sm:p-6 mt-8 border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {comparisonProperties.length} of 4 properties selected
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {comparisonProperties.length >= 2 ? 'Ready to compare!' : 'Add more properties to compare'}
                          </div>
                        </div>

                        {comparisonProperties.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-600">Selected:</div>
                            <div className="flex gap-1">
                              {comparisonProperties.map((property, index) => (
                                <div key={property._id} className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                                  {index + 1}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                        <button
                          onClick={() => setShowPropertySearch(false)}
                          className="w-full sm:w-auto px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                        >
                          Close
                        </button>
                        {comparisonProperties.length >= 2 && (
                          <button
                            onClick={() => {
                              setShowPropertySearch(false);
                              setTimeout(() => setShowComparisonModal(true), 0);
                            }}
                            className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium flex items-center justify-center gap-2"
                          >
                            <FaChartLine />
                            Compare Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      )
      }

      {/* AI Recommendations Modal */}
      {
        showAIRecommendations && currentUser && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-transparent dark:border-gray-800">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <div className="flex items-center gap-3">
                  <FaRobot className="text-2xl text-blue-600 dark:text-blue-400" />
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Advanced AI Property Recommendations</h2>
                </div>
                <button
                  onClick={() => setShowAIRecommendations(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  title="Close"
                >
                  <FaTimes className="text-xl" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-50 dark:bg-gray-950">
                <AdvancedAIRecommendations
                  userId={currentUser._id}
                  limit={8}
                  showTitle={false}
                  showInsights={true}
                  showModelInfo={true}
                  onRecommendationClick={(property) => {
                    // Close modal and navigate to property detail page
                    setShowAIRecommendations(false);
                    navigate(`/listing/${property._id}`);
                  }}
                />
              </div>
            </div>
          </div>
        )
      }

      {/* Social Share Panel */}
      <SocialSharePanel
        isOpen={showSocialShare}
        onClose={() => setShowSocialShare(false)}
        url={window.location.href}
        title={listing ? `${listing.name} - ${listing.type} in ${listing.address}` : "Check out this property!"}
        description={listing ? `Amazing ${listing.type} property in ${listing.address}. ${listing.description || ''}` : "Amazing property listing"}
      />

      {/* Property Comparison Social Share Panel */}
      <SocialSharePanel
        isOpen={showComparisonSocialShare}
        onClose={() => {
          setShowComparisonSocialShare(false);
          setSelectedComparisonProperty(null);
        }}
        url={selectedComparisonProperty ? `${window.location.origin}/listing/${selectedComparisonProperty._id}` : ''}
        title={selectedComparisonProperty ? `${selectedComparisonProperty.name} - ${selectedComparisonProperty.type} in ${selectedComparisonProperty.address}` : "Check out this property!"}
        description={selectedComparisonProperty ? `Amazing ${selectedComparisonProperty.type} property in ${selectedComparisonProperty.address}. ${selectedComparisonProperty.description || ''}` : "Amazing property listing"}
      />

      {/* Generic Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in-up border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Confirm Action</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{confirmModal.message || "Are you sure you want to proceed?"}</p>

            {/* Root Verification Input */}
            {confirmModal.type === 'root-verify' && (
              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Verification Reason/Notes (Optional):
                </label>
                <textarea
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  rows="3"
                  placeholder="Enter notes about this verification..."
                  value={rootVerificationReason}
                  onChange={(e) => setRootVerificationReason(e.target.value)}
                />
              </div>
            )}

            {/* Root Unpublish Input */}
            {confirmModal.type === 'root-unpublish' && (
              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Reason for Unpublishing (Required):
                </label>
                <textarea
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  rows="3"
                  placeholder="Explain why this property is being unpublished (sent to owner)..."
                  value={rootUnpublishReason}
                  onChange={(e) => setRootUnpublishReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmYes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <ContactSupportWrapper />
    </>
  );
}
