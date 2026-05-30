import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ListingItem from '../../components/ListingItem';
import { FaMapMarkerAlt, FaStar, FaBuilding, FaUserTie, FaCheckCircle, FaCommentDots, FaCalendarCheck, FaIdCard, FaArrowLeft, FaEdit, FaEnvelope, FaTimes, FaTrash, FaCheck, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import UrbanSetuSpinner from '../../components/UrbanSetuSpinner';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../config/api';
import { authenticatedFetch } from '../../utils/auth';
import { toast } from 'react-toastify';
import AgentProfileSkeleton from '../../components/skeletons/AgentProfileSkeleton';
import PreBookingChatWrapper from '../../components/PreBookingChatWrapper';
import AgentInfoModal from '../../components/AgentInfoModal';
import { usePageTitle } from '../../hooks/usePageTitle';
import SEO from '../../components/SEO';

const AgentProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Set Page Title
    const [title, setTitle] = useState("Agent Profile · UrbanSetu");
    usePageTitle(title);
    const [agent, setAgent] = useState(null);
    const [loading, setLoading] = useState(true);
    const { currentUser } = useSelector(state => state.user);
    const [listings, setListings] = useState([]);

    const seoDescription = agent 
        ? `${agent.name} is a RERA certified, verified real estate agent serving ${agent.city}. Experience: ${agent.experience} years. Agency: ${agent.agencyName || 'Independent'}. View active properties and contact for buying, selling, or renting.`
        : "Connect with verified real estate agents on UrbanSetu to buy, sell, or rent properties with expert guidance.";
    
    const seoKeywords = agent 
        ? `${agent.name}, real estate agent ${agent.city}, verified broker ${agent.city}, ${agent.areas?.join(', ') || ''}, UrbanSetu agent`
        : "real estate agents, find property agent, verified real estate brokers, UrbanSetu agents";
    
    const seoImage = agent?.photo || null;

    const agentSchema = agent ? {
        "@context": "https://schema.org",
        "@type": "RealEstateAgent",
        "name": agent.name,
        "image": agent.photo,
        "email": agent.email,
        "telephone": agent.mobileNumber,
        "address": {
            "@type": "PostalAddress",
            "addressLocality": agent.city,
            "addressCountry": "IN"
        },
        "priceRange": "$$",
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": agent.rating || 5,
            "reviewCount": agent.reviewCount || 1
        }
    } : null;

    // Edit Mode State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({});
    const [updating, setUpdating] = useState(false);

    // Review State
    const [reviews, setReviews] = useState([]);
    const [newReview, setNewReview] = useState({ rating: 0, comment: '' });
    const [submittingReview, setSubmittingReview] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState(null);
    const [editReviewData, setEditReviewData] = useState({ rating: 0, comment: '' });

    // Delete Confirmation State
    const [showDeleteReviewModal, setShowDeleteReviewModal] = useState(false);
    const [reviewToDelete, setReviewToDelete] = useState(null);

    // Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    useEffect(() => {
        fetchAgent();
    }, [id]);



    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (newReview.rating === 0) {
            toast.error("Please select a rating");
            return;
        }
        try {
            setSubmittingReview(true);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/review/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReview)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Review submitted successfully!");
                setReviews([data, ...reviews]);
                setNewReview({ rating: 0, comment: '' });
                // Update stats locally
                const count = (agent.reviewCount || 0) + 1;
                const newAvg = ((agent.rating * (agent.reviewCount || 0)) + newReview.rating) / count;
                setAgent(prev => ({
                    ...prev,
                    reviewCount: count,
                    rating: newAvg
                }));
            } else {
                toast.error(data.message || "Failed to submit review");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleDeleteReview = (reviewId) => {
        setReviewToDelete(reviewId);
        setShowDeleteReviewModal(true);
    };

    const confirmDeleteReview = async () => {
        if (!reviewToDelete) return;
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/review/${reviewToDelete}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success("Review deleted");
                setReviews(reviews.filter(r => r._id !== reviewToDelete));

                // Recalculate stats locally
                const remaining = reviews.filter(r => r._id !== reviewToDelete);
                const count = remaining.length;
                const total = remaining.reduce((acc, r) => acc + r.rating, 0);
                setAgent(prev => ({
                    ...prev,
                    reviewCount: count,
                    rating: count > 0 ? total / count : 0
                }));
            } else {
                toast.error("Failed to delete review");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        } finally {
            setShowDeleteReviewModal(false);
            setReviewToDelete(null);
        }
    };

    const startEditing = (review) => {
        setEditingReviewId(review._id);
        setEditReviewData({ rating: review.rating, comment: review.comment });
    };

    const handleUpdateReview = async (e) => {
        e.preventDefault();
        const originalReview = reviews.find(r => r._id === editingReviewId);
        if (originalReview.comment === editReviewData.comment && originalReview.rating === editReviewData.rating) {
            setEditingReviewId(null);
            return;
        }

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/review/${editingReviewId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editReviewData)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Review updated");
                setReviews(reviews.map(r => r._id === editingReviewId ? data : r));
                setEditingReviewId(null);

                // Recalculate stats locally (approximate or refetch)
                const updatedReviews = reviews.map(r => r._id === editingReviewId ? data : r);
                const total = updatedReviews.reduce((acc, r) => acc + r.rating, 0);
                setAgent(prev => ({
                    ...prev,
                    rating: total / updatedReviews.length
                }));
            } else {
                toast.error(data.message || "Failed to update");
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Admin Agent Management
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const handleUpdateStatus = async (status, reason = null) => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/admin/status/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, rejectionReason: reason })
            });

            if (res.ok) {
                toast.success(`Agent ${status} successfully`);
                setAgent(prev => ({ ...prev, status }));
                setShowApproveModal(false);
                setShowRejectModal(false);
            } else {
                toast.error("Failed to update status");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        }
    };

    const fetchAgent = async () => {

        try {
            const url = `${API_BASE_URL}/api/agent/profile/${id}`;
            const res = await authenticatedFetch(url);
            const data = await res.json();

            if (res.ok) {
                setAgent(data);
                setTitle(`${data.name} · Verified Real Estate Agent`);
                // Fetch listings using the user ID associated with this agent
                const userId = data.userId._id || data.userId;
                fetchListings(userId);
                // Fetch reviews for this agent
                fetchReviews(data._id);
            } else {
                console.error("Failed to fetch agent profile");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchListings = async (userId) => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/agent/listings/${userId}`);
            const data = await res.json();
            if (res.ok) {
                setListings(data);
            }
        } catch (error) {
            console.error("Error fetching listings:", error);
        }
    };

    const fetchReviews = async (agentId) => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/reviews/${agentId}`);
            const data = await res.json();
            if (res.ok) {
                setReviews(data);
            }
        } catch (error) {
            console.error("Error fetching reviews:", error);
        }
    };

    const handleBack = () => {
        if (currentUser) {
            navigate('/user/agents');
        } else {
            navigate('/agents');
        }
    };

    const isOwner = currentUser && agent && agent.userId && (agent.userId._id === currentUser._id || agent.userId === currentUser._id);

    const openEditModal = () => {
        setEditFormData({
            name: agent.name,
            mobileNumber: agent.mobileNumber,
            city: agent.city,
            agencyName: agent.agencyName || '',
            experience: agent.experience,
            about: agent.about || '',
            areas: agent.areas ? agent.areas.join(', ') : '',
            reraId: agent.reraId || ''
        });
        setShowEditModal(true);
    };

    const handleEditChange = (e) => {
        setEditFormData({
            ...editFormData,
            [e.target.name]: e.target.value
        });
    };

    const handleMessageAgent = () => {
        if (!currentUser) {
            toast.info("Please sign in to message the agent");
            navigate('/sign-in'); // Optional: redirect to login
            return;
        }
        setIsChatOpen(true);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            setUpdating(true);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/update/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFormData)
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Profile updated successfully!");
                setAgent(data); // Update local state with new data
                setShowEditModal(false);
            } else {
                toast.error(data.message || "Failed to update profile");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <AgentProfileSkeleton />;

    if (!agent) return (
        <div className="min-h-screen pt-20 flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 animate-fade-in-up">
                <div className="text-6xl mb-4">🕵️</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Agent Not Found</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">The agent profile you are looking for does not exist or has been removed.</p>
                <button
                    onClick={handleBack}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md transform hover:scale-105"
                >
                    Back to Agents
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-12 transition-colors duration-300">
            <SEO
                title={title}
                description={seoDescription}
                keywords={seoKeywords}
                image={seoImage}
                type="profile"
                schema={agentSchema}
            />
            {/* Header / Cover */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-gray-800 dark:to-gray-900 h-48 md:h-60 relative transition-colors duration-300">
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/city-fields.png')]"></div>

                {/* Header Content & Buttons */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 h-full">
                    <div className="absolute top-6 w-full flex flex-wrap justify-between pr-4 sm:pr-8 gap-3">
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 px-4 py-2 rounded-lg transition-all backdrop-blur-sm"
                        >
                            <FaArrowLeft /> Back to Agents
                        </button>

                        {isOwner && (
                            <button
                                onClick={openEditModal}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-lg transition-all transform hover:scale-105"
                            >
                                <FaEdit /> Edit Profile
                            </button>
                        )}
                    </div>


                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-30">


                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="md:flex">
                        {/* Sidebar / Left Info */}
                        <div className="md:w-1/3 bg-gray-50 dark:bg-gray-800/50 p-6 md:p-8 text-center md:text-left border-r border-gray-100 dark:border-gray-700 relative">
                            <button
                                onClick={() => setShowInfoModal(true)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 transition-colors z-10"
                                title="About Agents"
                            >
                                <FaInfoCircle className="text-xl" />
                            </button>
                            <div className="relative inline-block md:block mb-4">
                                <img
                                    src={agent.photo}
                                    alt={agent.name}
                                    className="w-40 h-40 md:w-56 md:h-56 rounded-full md:rounded-2xl object-cover border-4 border-white dark:border-gray-700 shadow-lg mx-auto md:mx-0"
                                />
                                {agent.isVerified && (
                                    <div className="absolute bottom-2 right-2 md:-bottom-2 md:-right-2 bg-blue-500 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-gray-800" title="Verified Agent">
                                        <FaUserTie />
                                    </div>
                                )}
                            </div>

                            {/* Name logic moved to header, but we can keep subtle branding here or remove H1 */}
                            {/* Let's keep a smaller version or just agency info */}

                            {agent.agencyName && (
                                <p className="text-gray-600 dark:text-gray-400 flex items-center justify-center md:justify-start gap-2 mb-4 mt-2">
                                    <FaBuilding /> {agent.agencyName}
                                </p>
                            )}

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-white dark:bg-gray-700 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 text-center">
                                    <span className="block text-2xl font-bold text-blue-600 dark:text-blue-400">{agent.experience}+</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-300">Years Exp.</span>
                                </div>
                                <div className="bg-white dark:bg-gray-700 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 text-center">
                                    <span className="block text-2xl font-bold text-yellow-500 flex justify-center items-center gap-1">
                                        {agent.rating.toFixed(1)} <FaStar className="text-base" />
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-300">{agent.reviewCount || 0} Review(s)</span>
                                </div>
                            </div>

                            {/* Action Buttons: Show contact ONLY if NOT owner */}
                            {!isOwner && currentUser && (
                                <div className="space-y-3">
                                    <button className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold shadow-md transition-all hover:scale-105">
                                        <FaCalendarCheck /> Book Appointment Coming Soon... Use Chat to Contact
                                    </button>
                                </div>
                            )}

                            {!currentUser && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 text-center">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2 font-medium">Log in to contact this agent</p>
                                    <Link to="/sign-in" className="inline-block px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
                                        Sign In
                                    </Link>
                                </div>
                            )}

                            {/* Owner Info: Maybe show some status or simple text */}
                            {isOwner && (
                                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">This is your public profile view.</p>
                                </div>
                            )}

                        </div>

                        {/* Main Content */}
                        <div className="md:w-2/3 p-6 md:p-10">
                            {/* Agent Header Info */}
                            <div className="mb-8 animate-fade-in-up">
                                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-wider uppercase mb-2">
                                    Professional Agent
                                </span>
                                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">{agent.name}</h1>
                                <p className="text-gray-500 dark:text-gray-400 max-w-xl">{agent.city} • {agent.experience} Years Experience</p>
                            </div>

                            {/* Admin Management Panel */}
                            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && (
                                <>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-blue-200 dark:border-blue-900 shadow-lg mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                                <FaUserTie />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white">Admin Controls</h3>
                                                <p className="text-xs text-gray-500">Manage this agent account</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${agent.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' :
                                                agent.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                Current Status: {agent.status}
                                            </span>

                                            {agent.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => setShowApproveModal(true)}
                                                        className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-transform hover:scale-105 shadow-sm text-xs font-bold flex items-center gap-1"
                                                    >
                                                        <FaCheck /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => setShowRejectModal(true)}
                                                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-transform hover:scale-105 shadow-sm text-xs font-bold flex items-center gap-1"
                                                    >
                                                        <FaTimes /> Reject
                                                    </button>
                                                </>
                                            )}

                                            {agent.status === 'approved' && (
                                                <button
                                                    onClick={() => setShowRejectModal(true)}
                                                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-transform hover:scale-105 shadow-sm text-xs font-bold flex items-center gap-1"
                                                >
                                                    <FaTimes /> Revoke
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900 mb-6 flex flex-wrap gap-6 animate-fade-in-up">
                                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <FaEnvelope className="text-blue-500" />
                                            <span className="font-semibold">Email:</span>
                                            <span>{agent.userId?.email || agent.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <FaUserTie className="text-purple-500" />
                                            <span className="font-semibold">Gender:</span>
                                            <span className="capitalize">{agent.userId?.gender || 'Not Specified'}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                            {/* About Section */}
                            <section className="mb-10">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b dark:border-gray-700 pb-2">About {agent.name.split(' ')[0]}</h3>
                                <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                    {agent.about || "No description provided."}
                                </p>
                            </section>

                            {/* Details Grid */}
                            <section className="mb-10">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b dark:border-gray-700 pb-2">Professional Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-gray-500 dark:text-gray-300">
                                            <FaMapMarkerAlt />
                                        </div>
                                        <div>
                                            <span className="block text-sm text-gray-500 dark:text-gray-400">Operating City</span>
                                            <span className="font-semibold text-gray-900 dark:text-white">{agent.city}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-gray-500 dark:text-gray-300">
                                            <FaBuilding />
                                        </div>
                                        <div>
                                            <span className="block text-sm text-gray-500 dark:text-gray-400">Areas Served</span>
                                            <span className="font-semibold text-gray-900 dark:text-white">
                                                {agent.areas && agent.areas.length > 0 ? agent.areas.join(', ') : 'Not specified'}
                                            </span>
                                        </div>
                                    </div>
                                    {agent.reraId && (
                                        <div className="flex items-start gap-3">
                                            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-gray-500 dark:text-gray-300">
                                                <FaIdCard />
                                            </div>
                                            <div>
                                                <span className="block text-sm text-gray-500 dark:text-gray-400">RERA Registration</span>
                                                <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sm text-gray-800 dark:text-gray-200">{agent.reraId}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Listings Section (Placeholder for now) */}
                            {/* Listings Section */}
                            {currentUser && (
                                <section className="mb-10">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b dark:border-gray-700 pb-2 flex justify-between items-center">
                                        <span>Active Listings</span>
                                        {listings.length > 0 && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{listings.length}</span>}
                                    </h3>
                                    {listings.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                                            {listings.map((listing) => (
                                                <ListingItem key={listing._id} listing={listing} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl text-center border border-dashed border-gray-300 dark:border-gray-600">
                                            <p className="text-gray-500 dark:text-gray-400">No active listings at the moment.</p>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Reviews Section */}
                            {currentUser && (
                                <section>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b dark:border-gray-700 pb-2 flex justify-between items-center">
                                        <span>Client Reviews</span>
                                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                            {agent.reviewCount} review{agent.reviewCount !== 1 ? 's' : ''}
                                        </span>
                                    </h3>

                                    {/* Review List */}
                                    <div className="space-y-6 mb-10">
                                        {reviews.length > 0 ? (
                                            reviews.map((review) => (
                                                <div key={review._id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                    {editingReviewId === review._id ? (
                                                        <form onSubmit={handleUpdateReview} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 transition-all animate-fade-in-up">
                                                            <h4 className="font-bold text-gray-900 dark:text-white mb-3">Edit Review</h4>

                                                            <div className="mb-3">
                                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rating</label>
                                                                <div className="flex gap-2">
                                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                                        <button
                                                                            type="button"
                                                                            key={star}
                                                                            onClick={() => setEditReviewData({ ...editReviewData, rating: star })}
                                                                            className={`text-lg transition-colors ${star <= editReviewData.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                                                                        >
                                                                            <FaStar />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="mb-3">
                                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your Experience</label>
                                                                <textarea
                                                                    value={editReviewData.comment}
                                                                    onChange={(e) => setEditReviewData({ ...editReviewData, comment: e.target.value })}
                                                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                                                                    rows="3"
                                                                    placeholder="Update your review..."
                                                                ></textarea>
                                                            </div>

                                                            <div className="flex gap-3">
                                                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Save Changes</button>
                                                                <button type="button" onClick={() => setEditingReviewId(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancel</button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <img src={review.userAvatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"} alt={review.userName} className="w-10 h-10 rounded-full object-cover" />
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{review.userName}</h4>
                                                                    <div className="flex text-yellow-400 text-xs">
                                                                        {[...Array(5)].map((_, i) => (
                                                                            <FaStar key={i} className={i < review.rating ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"} />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <span className="ml-auto flex items-center gap-2">
                                                                    <span className="text-xs text-gray-400">
                                                                        {new Date(review.createdAt).toLocaleDateString()}
                                                                        {(review.isEdited || (review.updatedAt && new Date(review.updatedAt).getTime() > new Date(review.createdAt).getTime())) && (
                                                                            <span className="italic ml-1">(edited)</span>
                                                                        )}
                                                                    </span>
                                                                    {currentUser && (
                                                                        (currentUser._id === review.userId || currentUser.role === 'admin' || currentUser.role === 'rootadmin')
                                                                    ) && (
                                                                            <div className="flex gap-2 ml-2">
                                                                                {currentUser._id === review.userId && (
                                                                                    <button
                                                                                        onClick={() => startEditing(review)}
                                                                                        className="text-blue-500 hover:text-blue-700 transition-colors"
                                                                                        title="Edit Review"
                                                                                    >
                                                                                        <FaEdit size={12} />
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    onClick={() => handleDeleteReview(review._id)}
                                                                                    className="text-red-500 hover:text-red-700 transition-colors"
                                                                                    title="Delete Review"
                                                                                >
                                                                                    <FaTrash size={12} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                </span>
                                                            </div>
                                                            <p className="text-gray-600 dark:text-gray-300 text-sm pl-13">{review.comment}</p>
                                                        </>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 dark:text-gray-400 italic">No reviews yet. Be the first to review!</p>
                                        )}
                                    </div>

                                    {/* Review Form */}
                                    {currentUser && !isOwner && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <h4 className="font-bold text-gray-900 dark:text-white mb-4">Write a Review</h4>
                                            <form onSubmit={handleReviewSubmit}>
                                                <div className="mb-4">
                                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Rating</label>
                                                    <div className="flex gap-2">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                type="button"
                                                                key={star}
                                                                onClick={() => setNewReview({ ...newReview, rating: star })}
                                                                className={`text-2xl transition-colors ${star <= newReview.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-200'}`}
                                                            >
                                                                <FaStar />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="mb-4">
                                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Your Experience</label>
                                                    <textarea
                                                        rows="3"
                                                        value={newReview.comment}
                                                        onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="Share your experience working with this agent..."
                                                        required
                                                    ></textarea>
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={submittingReview}
                                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-70"
                                                >
                                                    {submittingReview ? <UrbanSetuSpinner size="xs" isBright={true} /> : 'Submit Review'}
                                                </button>
                                            </form>
                                        </div>
                                    )}

                                    {currentUser && isOwner && (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                                            <p className="text-blue-600 dark:text-blue-400 font-medium">This is your public profile. You cannot write a review for yourself.</p>
                                        </div>
                                    )}

                                    {!currentUser && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                                            <p className="text-gray-500 dark:text-gray-400 mb-3">Please log in to write a review.</p>
                                            <Link to="/sign-in" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Login Now</Link>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    </div>
                </div >

                {/* Edit Modal */}
                {
                    showEditModal && createPortal(
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 transform transition-all scale-100 my-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
                                    <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                        <FaTimes size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleUpdateProfile} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={editFormData.name}
                                                onChange={handleEditChange}
                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
                                            <input
                                                type="text"
                                                name="mobileNumber"
                                                value={editFormData.mobileNumber}
                                                onChange={handleEditChange}
                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operating City</label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={editFormData.city}
                                                onChange={handleEditChange}
                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Experience (Years)</label>
                                            <input
                                                type="number"
                                                name="experience"
                                                value={editFormData.experience}
                                                onChange={handleEditChange}
                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agency Name</label>
                                            <input
                                                type="text"
                                                name="agencyName"
                                                value={editFormData.agencyName}
                                                onChange={handleEditChange}
                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RERA ID</label>
                                            <input
                                                type="text"
                                                name="reraId"
                                                value={editFormData.reraId}
                                                onChange={handleEditChange}
                                                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Areas Served (comma separated)</label>
                                        <input
                                            type="text"
                                            name="areas"
                                            value={editFormData.areas}
                                            onChange={handleEditChange}
                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. Area1, Area2"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio / About</label>
                                        <textarea
                                            name="about"
                                            rows="4"
                                            value={editFormData.about}
                                            onChange={handleEditChange}
                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        ></textarea>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowEditModal(false)}
                                            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={updating}
                                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 disabled:opacity-70 disabled:scale-100 flex justify-center items-center gap-2"
                                        >
                                            {updating ? <UrbanSetuSpinner size="xs" isBright={true} /> : 'Save Changes'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-4 text-center">
                                        By saving changes, you agree to our <a href="/user/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Terms and Conditions for Partners</a>.
                                    </p>
                                </form>
                            </div>
                        </div>,
                        document.body
                    )
                }
                {/* Approve Modal */}
                {
                    showApproveModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 mx-auto text-green-600 dark:text-green-400">
                                    <FaCheck size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Approve Agent?</h3>
                                <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm">
                                    Are you sure you want to approve <strong>{agent.name}</strong>? They will gain access to agent features immediately.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowApproveModal(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus('approved')}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors shadow-lg shadow-green-500/30"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Reject Modal */}
                {
                    showRejectModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all scale-100">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600 dark:text-red-400">
                                    <FaExclamationTriangle size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                                    {agent.status === 'approved' ? 'Revoke Access' : 'Reject Application'}
                                </h3>
                                <p className="text-center text-gray-500 dark:text-gray-400 mb-4 text-sm">
                                    {agent.status === 'approved'
                                        ? <span>You are regarding to revoke access for <strong>{agent.name}</strong>.</span>
                                        : <span>You are about to reject <strong>{agent.name}</strong>.</span>
                                    }
                                    Please provide a reason below.
                                </p>
                                <textarea
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none resize-none h-32 text-sm mb-4"
                                    placeholder="Reason for rejection (required)..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                ></textarea>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowRejectModal(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus('rejected', rejectReason)}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-500/30"
                                    >
                                        Reject Agent
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Delete Review Modal */}
                {
                    showDeleteReviewModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-fade-in">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all scale-100">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600 dark:text-red-400">
                                    <FaTrash size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Review?</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                                    Are you sure you want to delete this review? This action cannot be undone.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDeleteReviewModal(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDeleteReview}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-500/30"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

                {/* Chat Wrapper for Agent Inquiry */}
                {
                    agent && (
                        <PreBookingChatWrapper
                            ownerId={agent.userId?._id || agent.userId}
                            listingId={null}
                            listingTitle={`Chat with ${agent.name}`}
                            showFloatingButton={true}
                        />
                    )
                }

                {/* Info Modal */}
                <AgentInfoModal
                    isOpen={showInfoModal}
                    onClose={() => setShowInfoModal(false)}
                />

            </div >
        </div >
    );
};

export default AgentProfile;

