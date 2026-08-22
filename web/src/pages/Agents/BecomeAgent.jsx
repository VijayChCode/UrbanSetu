import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaUserShield, FaCheckCircle, FaBuilding, FaIdCard, FaArrowLeft, FaUserTie, FaClock, FaExclamationTriangle, FaHeadset, FaEnvelope } from 'react-icons/fa';
import UrbanSetuSpinner from '../../components/UrbanSetuSpinner';
import BecomeAgentSkeleton from '../../components/skeletons/BecomeAgentSkeleton';
import { API_BASE_URL } from '../../config/api';
import { authenticatedFetch } from '../../utils/auth';
import { usePageTitle } from '../../hooks/usePageTitle';

const BecomeAgent = () => {
    usePageTitle('Become an Agent - UrbanSetu');
    const { currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [existingAgent, setExistingAgent] = useState(null);
    const [agentStatus, setAgentStatus] = useState(null);
    const [agentId, setAgentId] = useState(null);

    const contactUrl = currentUser ? '/user/contact' : '/contact';

    useEffect(() => {
        if (currentUser) {
            checkAgentStatus();
        } else {
            setCheckingStatus(false);
        }
    }, [currentUser]);

    const checkAgentStatus = async () => {
        try {
            setCheckingStatus(true);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/status/me`);
            const data = await res.json();
            if (res.ok && data.isAgent) {
                setAgentStatus(data.status);
                setAgentId(data.agentId);
                let agentDoc = data.agent;
                if (!agentDoc && data.agentId) {
                    const profileRes = await authenticatedFetch(`${API_BASE_URL}/api/agent/profile/${data.agentId}`);
                    if (profileRes.ok) {
                        agentDoc = await profileRes.json();
                    }
                }
                setExistingAgent(agentDoc);

                // If rejected and can reapply, prefill previous form values
                if (data.status === 'rejected' && agentDoc) {
                    setFormData({
                        name: agentDoc.name || (currentUser ? currentUser.username : ''),
                        mobileNumber: agentDoc.mobileNumber || (currentUser ? currentUser.mobileNumber : ''),
                        city: agentDoc.city || (currentUser ? currentUser.address || '' : ''),
                        experience: agentDoc.experience !== undefined && agentDoc.experience !== null ? agentDoc.experience.toString() : '',
                        about: agentDoc.about || '',
                        areas: Array.isArray(agentDoc.areas) ? agentDoc.areas.join(', ') : (agentDoc.areas || ''),
                        reraId: agentDoc.reraId || '',
                        agencyName: agentDoc.agencyName || '',
                    });
                }
            }
        } catch (error) {
            console.error("Error checking status:", error);
        } finally {
            setCheckingStatus(false);
        }
    };

    // Form data state
    const [formData, setFormData] = useState({
        name: currentUser ? currentUser.username : '',
        mobileNumber: currentUser ? currentUser.mobileNumber : '',
        city: currentUser ? currentUser.address || '' : '',
        experience: '',
        about: '',
        areas: '',
        reraId: '',
        agencyName: '',
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) {
            toast.error("Please sign in to apply.");
            navigate('/sign-in');
            return;
        }

        try {
            // Check for rejection freeze (Only if Revoked)
            if (existingAgent && existingAgent.status === 'rejected' && existingAgent.revokedAt) {
                const revokedDate = new Date(existingAgent.revokedAt);
                const now = new Date();
                const diffTime = Math.abs(now - revokedDate);
                const daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const freezePeriod = 30;

                if (daysPassed < freezePeriod) {
                    const daysLeft = freezePeriod - daysPassed;
                    toast.error(`Account revoked. You can re-apply in ${daysLeft} days.`);
                    return;
                }
            }

            setLoading(true);
            const areasArray = formData.areas.split(',').map(area => area.trim()).filter(area => area.length > 0);

            const payload = {
                ...formData,
                areas: areasArray,
                experience: parseInt(formData.experience) || 0
            };

            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/apply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('Application submitted successfully!');
                navigate('/user/agents');
            } else {
                toast.error(data.message || "Something went wrong");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Check if agent can re-apply (only rejected without active freeze)
    const canReapply = agentStatus === 'rejected' && existingAgent && (
        !existingAgent.revokedAt ||
        Math.ceil(Math.abs(new Date() - new Date(existingAgent.revokedAt)) / (1000 * 60 * 60 * 24)) >= 30
    );

    // Show loading while checking status
    if (checkingStatus) {
        return <BecomeAgentSkeleton />;
    }

    // === BLOCK: Already Approved Agent ===
    if (agentStatus === 'approved' && agentId) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12 transition-colors duration-300">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <button onClick={() => navigate('/user/agents')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
                            <FaArrowLeft /> Back to Agents
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaUserTie className="text-4xl text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">You're Already an Agent! 🎉</h2>
                        </div>

                        <div className="p-8 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold mb-6">
                                <FaCheckCircle /> Approved & Active
                            </div>

                            <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
                                You are already a registered agent on UrbanSetu.
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 mb-8">
                                If you need to make changes, update your profile from your agent page.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                                <Link
                                    to={`/user/agents/${agentId}`}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto"
                                >
                                    <FaUserTie /> View & Edit Profile
                                </Link>
                                <Link
                                    to={contactUrl}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all duration-300 w-full sm:w-auto"
                                >
                                    <FaHeadset /> Contact Support
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-up {
                        animation: fadeInUp 0.6s ease-out;
                    }
                `}</style>
            </div>
        );
    }

    // === BLOCK: Pending Application ===
    if (agentStatus === 'pending') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12 transition-colors duration-300">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <button onClick={() => navigate('/user/agents')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
                            <FaArrowLeft /> Back to Agents
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaClock className="text-4xl text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Application Under Review</h2>
                        </div>

                        <div className="p-8 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-semibold mb-6">
                                <FaClock /> Pending Review
                            </div>

                            <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
                                Your agent application is currently being reviewed by our team.
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                You'll be notified once a decision is made. This usually takes 1-3 business days.
                            </p>

                            {/* Contact Support info box */}
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl mb-8 text-sm text-gray-600 dark:text-gray-300">
                                <p className="font-medium text-amber-800 dark:text-amber-300 mb-1 flex items-center justify-center gap-1.5">
                                    <FaHeadset className="text-amber-600 dark:text-amber-400" /> Need Help or Have Questions?
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    If you have any questions about your application or need expedited verification, please feel free to reach out to our support team.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                                <button
                                    onClick={() => navigate('/user/agents')}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto"
                                >
                                    Browse Agents
                                </button>
                                <Link
                                    to={contactUrl}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto"
                                >
                                    <FaHeadset /> Contact Support
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-up {
                        animation: fadeInUp 0.6s ease-out;
                    }
                `}</style>
            </div>
        );
    }

    // === BLOCK: Revoked and within freeze period ===
    if (agentStatus === 'rejected' && existingAgent?.revokedAt && !canReapply) {
        const daysPassed = Math.ceil(Math.abs(new Date() - new Date(existingAgent.revokedAt)) / (1000 * 60 * 60 * 24));
        const daysLeft = 30 - daysPassed;

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12 transition-colors duration-300">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <button onClick={() => navigate('/user/agents')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
                            <FaArrowLeft /> Back to Agents
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
                        <div className="bg-gradient-to-r from-red-500 to-rose-600 p-6 text-center">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaExclamationTriangle className="text-4xl text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Account Revoked</h2>
                        </div>

                        <div className="p-8 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-semibold mb-6">
                                <FaExclamationTriangle /> {daysLeft} days remaining in cool-off period
                            </div>

                            <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
                                Your agent account was revoked.
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                You can re-apply after the 30-day cool-off period ends. Please wait {daysLeft} more day{daysLeft !== 1 ? 's' : ''}.
                            </p>

                            {/* Contact Support info box */}
                            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl mb-8 text-sm text-gray-600 dark:text-gray-300">
                                <p className="font-medium text-red-800 dark:text-red-300 mb-1 flex items-center justify-center gap-1.5">
                                    <FaHeadset className="text-red-600 dark:text-red-400" /> Have Questions Regarding Your Account?
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    If you believe this revocation was made in error or would like further information, please contact our support team.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                                <button
                                    onClick={() => navigate('/user/agents')}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto"
                                >
                                    Browse Agents
                                </button>
                                <Link
                                    to={contactUrl}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto"
                                >
                                    <FaHeadset /> Contact Support
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in-up {
                        animation: fadeInUp 0.6s ease-out;
                    }
                `}</style>
            </div>
        );
    }

    // === NORMAL: Show Application Form (new applicants or rejected agents who can reapply) ===
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12 transition-colors duration-300">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Back Link */}
                <div className="mb-6">
                    <button onClick={() => navigate('/user/agents')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
                        <FaArrowLeft /> Back to Agents
                    </button>
                </div>

                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mb-6">
                        <FaUserShield className="text-4xl" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-2">Become a Partner Agent</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Join the UrbanSetu network and connect with thousands of potential buyers and renters.
                    </p>
                </div>

                {/* Re-application notice */}
                {canReapply && (
                    <div className="mb-8 p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl shadow-sm animate-fade-in-up">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl text-lg shrink-0 mt-0.5">
                                <FaExclamationTriangle />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-200/70 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full">
                                        Previous Application Not Approved
                                    </span>
                                    <span className="text-[11px] text-green-700 dark:text-green-400 font-semibold bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                                        ✓ Instant Re-application Available
                                    </span>
                                </div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                    Update Your Details & Re-Submit
                                </h3>
                                {existingAgent?.rejectionReason ? (
                                    <div className="p-3 bg-white/80 dark:bg-gray-800/80 rounded-xl border border-amber-200 dark:border-amber-800/50 mb-2 text-sm text-gray-700 dark:text-gray-300">
                                        <span className="font-bold text-amber-800 dark:text-amber-300">Admin Feedback: </span>
                                        <span className="italic">"{existingAgent.rejectionReason}"</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                        Your previous submission was not approved. Your existing details have been pre-filled below so you can update them easily.
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    Need assistance with verification requirements? <Link to={contactUrl} className="text-blue-600 dark:text-blue-400 hover:underline font-bold">Contact Support Team</Link>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 lg:grid-cols-3">
                        {/* Left Side Info */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white hidden lg:block">
                            <h3 className="text-2xl font-bold mb-6">Why Join Us?</h3>
                            <ul className="space-y-6">
                                <li className="flex gap-3">
                                    <FaCheckCircle className="text-green-300 text-xl flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-semibold">Maximize Exposure</h4>
                                        <p className="text-blue-100 text-sm mt-1">Get listed on our exclusive "Find an Agent" directory checked by thousands daily.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <FaCheckCircle className="text-green-300 text-xl flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-semibold">Verified Badge</h4>
                                        <p className="text-blue-100 text-sm mt-1">Earn a trusted badge that boosts your credibility with clients.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <FaCheckCircle className="text-green-300 text-xl flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-semibold">Smart Dashboard</h4>
                                        <p className="text-blue-100 text-sm mt-1">Manage leads, properties, and appointments all in one place (Coming Soon).</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Form */}
                        <div className="col-span-2 p-6 lg:p-10">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                                        <input id="name" type="text" required className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.name} />
                                    </div>
                                    <div>
                                        <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number *</label>
                                        <input id="mobileNumber" type="text" required className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.mobileNumber} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operating City *</label>
                                        <input id="city" type="text" required placeholder="e.g. Hyderabad" className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.city} />
                                    </div>
                                    <div>
                                        <label htmlFor="experience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Years of Experience *</label>
                                        <input id="experience" type="number" required min="0" className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.experience} />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="areas" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Areas Served (comma separated)</label>
                                    <input id="areas" type="text" placeholder="e.g. Gachibowli, Hitech City, Madhapur" className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.areas} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="agencyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agency Name (Optional)</label>
                                        <div className="relative">
                                            <FaBuilding className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                            <input id="agencyName" type="text" placeholder="e.g. UrbanSetu Realty Group" className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.agencyName} />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="reraId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RERA ID (Optional)</label>
                                        <div className="relative">
                                            <FaIdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                            <input id="reraId" type="text" placeholder="e.g. RAJ/A/2026/000123" className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.reraId} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="about" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">About You (Bio)</label>
                                    <textarea id="about" rows="4" className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" placeholder="Briefly describe your expertise..." onChange={handleChange} value={formData.about}></textarea>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                    >
                                        {loading ? <UrbanSetuSpinner size="xs" isBright={true} /> : 'Submit Application'}
                                    </button>
                                    <p className="text-xs text-gray-500 mt-4 text-center">
                                        By submitting, you agree to our <a href="/user/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Terms and Conditions</a> for Partners.
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BecomeAgent;
