import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaUserShield, FaCheckCircle, FaBuilding, FaIdCard, FaArrowLeft } from 'react-icons/fa';
import UrbanSetuSpinner from '../../components/UrbanSetuSpinner';
import { API_BASE_URL } from '../../config/api';
import { authenticatedFetch } from '../../utils/auth';
import { usePageTitle } from '../../hooks/usePageTitle';

const BecomeAgent = () => {
    usePageTitle('Become an Agent - UrbanSetu');
    const { currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [existingAgent, setExistingAgent] = useState(null);

    useEffect(() => {
        if (currentUser) {
            checkAgentStatus();
        }
    }, [currentUser]);

    const checkAgentStatus = async () => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/status/me`);
            const data = await res.json();
            if (res.ok && data.isAgent) {
                // Fetch full profile to get updatedAt
                const profileRes = await authenticatedFetch(`${API_BASE_URL}/api/agent/profile/${data.agentId}`);
                const profileData = await profileRes.json();
                setExistingAgent(profileData);
            }
        } catch (error) {
            console.error("Error checking status:", error);
        }
    };

    const [formData, setFormData] = useState({
        name: currentUser ? currentUser.username : '',
        mobileNumber: currentUser ? currentUser.mobileNumber : '',
        city: currentUser ? currentUser.address || '' : '',
        yearsOfExperience: '',
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
                areas: areasArray
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12 transition-colors duration-300">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Back Link */}
                <div className="mb-6">
                    <button onClick={() => navigate('/agents')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
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
                                        <label htmlFor="yearsOfExperience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Years of Experience *</label>
                                        <input id="yearsOfExperience" type="number" required min="0" className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.yearsOfExperience} />
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
                                            <input id="agencyName" type="text" className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.agencyName} />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="reraId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RERA ID (Optional)</label>
                                        <div className="relative">
                                            <FaIdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                            <input id="reraId" type="text" className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors" onChange={handleChange} value={formData.reraId} />
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
                                        By submitting, you agree to our <a href="/user/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Terms and Conditions for Partners</a>.
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
