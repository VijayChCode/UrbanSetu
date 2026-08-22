import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaCheck, FaTimes, FaSearch, FaUserTie, FaArrowLeft, FaArrowRight, FaExclamationTriangle, FaEye, FaBuilding, FaIdCard, FaMapMarkerAlt, FaPhone, FaEnvelope, FaCalendarAlt, FaInfoCircle, FaFileAlt, FaUserShield } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/api';
import { authenticatedFetch } from '../utils/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import AdminAgentsSkeleton from '../components/skeletons/AdminAgentsSkeleton';

const AdminAgents = () => {
    usePageTitle('Manage Agents - UrbanSetu');
    const { currentUser } = useSelector(state => state.user);
    const isRootAdmin = currentUser?.role === 'rootadmin' || currentUser?.isDefaultAdmin;

    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, pending, approved, rejected, revoked
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Modals
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [selectedAgent, setSelectedAgent] = useState(null);

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/admin/all`);
            const data = await res.json();
            if (res.ok) {
                setAgents(data);
            } else {
                toast.error("Failed to fetch agents");
            }
        } catch (error) {
            console.error(error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, status, reason = null) => {
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/agent/admin/status/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, rejectionReason: reason })
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(`Agent ${status} successfully`);
                // Directly update local agents array without triggering skeleton loading
                setAgents(prev => prev.map(a => a._id === id ? data : a));
                if (selectedAgent && selectedAgent._id === id) {
                    setSelectedAgent(data);
                }
                setShowDetailsModal(false);
                setShowApproveModal(false);
                setShowRejectModal(false);
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        }
    };

    const openDetailsModal = (agent) => {
        setSelectedAgent(agent);
        setShowDetailsModal(true);
    };

    const openRejectModal = (agent) => {
        setSelectedAgent(agent);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const openApproveModal = (agent) => {
        setSelectedAgent(agent);
        setShowApproveModal(true);
    };

    const submitRejection = () => {
        if (!selectedAgent) return;
        if (!rejectReason.trim()) return toast.warning("Please provide a reason");
        handleUpdateStatus(selectedAgent._id, 'rejected', rejectReason);
    };

    const submitApproval = () => {
        if (!selectedAgent) return;
        handleUpdateStatus(selectedAgent._id, 'approved');
    };

    const filteredAgents = agents.filter(agent => {
        // Status Filter
        let matchesStatus = false;
        if (filter === 'all') matchesStatus = true;
        else if (filter === 'revoked') matchesStatus = agent.status === 'rejected' && agent.revokedAt;
        else if (filter === 'rejected') matchesStatus = agent.status === 'rejected' && !agent.revokedAt;
        else matchesStatus = agent.status === filter;

        // Search Filter
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            agent.name.toLowerCase().includes(searchLower) ||
            agent.email.toLowerCase().includes(searchLower) ||
            agent.city.toLowerCase().includes(searchLower) ||
            (agent.agencyName && agent.agencyName.toLowerCase().includes(searchLower)) ||
            (agent.reraId && agent.reraId.toLowerCase().includes(searchLower)) ||
            (agent.mobileNumber && agent.mobileNumber.includes(searchLower));

        return matchesStatus && matchesSearch;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedAgents = filteredAgents.slice(startIndex, startIndex + itemsPerPage);

    if (loading && agents.length === 0) {
        return <AdminAgentsSkeleton />;
    }

    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FaUserTie className="text-blue-600" /> Agent Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Review, verify, approve, and manage partner agent applications.
                    </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex w-full md:w-auto bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    {['all', 'pending', 'approved', 'rejected', 'revoked'].map(f => (
                        <button
                            key={f}
                            onClick={() => { setFilter(f); setCurrentPage(1); }}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap ${filter === f
                                ? 'bg-blue-600 text-white shadow-md transform scale-105'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="relative w-full md:max-w-md">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, city, email, phone, or RERA ID..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-sm"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Agent Details</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Location & Areas</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Experience & RERA</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700">About / Bio</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Status & Date</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading && agents.length === 0 ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                                <div className="space-y-2">
                                                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-2">
                                                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="p-4"><div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                                        <td className="p-4"><div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                                        <td className="p-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
                                        <td className="p-4"><div className="flex justify-end gap-2"><div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div><div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div></div></td>
                                    </tr>
                                ))
                            ) : paginatedAgents.length === 0 ? (
                                <tr><td colSpan="6" className="p-12 text-center text-gray-500">No agents found matching your criteria.</td></tr>
                            ) : (
                                paginatedAgents.map((agent, index) => (
                                    <tr
                                        key={agent._id}
                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                                        style={{ animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards` }}
                                    >
                                        {/* Agent Details */}
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={agent.photo || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200 border-2 border-white dark:border-gray-600 shadow-sm shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{agent.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{agent.email} • {agent.mobileNumber}</p>
                                                    {agent.agencyName && (
                                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                                                            <FaBuilding className="text-[10px] shrink-0" /> {agent.agencyName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Location & Areas */}
                                        <td className="p-4 text-xs text-gray-600 dark:text-gray-300">
                                            <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                                                <FaMapMarkerAlt className="text-red-500 text-[11px]" /> {agent.city}
                                            </p>
                                            {agent.areas && agent.areas.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 mt-1 max-w-[180px]">
                                                    {agent.areas.slice(0, 2).map((area, idx) => (
                                                        <span key={idx} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[120px]" title={area}>
                                                            {area}
                                                        </span>
                                                    ))}
                                                    {agent.areas.length > 2 && (
                                                        <span className="text-[10px] text-gray-400 font-medium self-center">
                                                            +{agent.areas.length - 2} more
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-400 italic">No areas specified</span>
                                            )}
                                        </td>

                                        {/* Experience & RERA */}
                                        <td className="p-4 text-xs">
                                            <div className="space-y-1">
                                                <span className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded text-xs font-semibold">
                                                    {agent.experience || 0} Years Exp
                                                </span>
                                                <div>
                                                    {agent.reraId ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold" title={`RERA ID: ${agent.reraId}`}>
                                                            <FaIdCard className="text-[9px]" /> {agent.reraId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 italic">No RERA ID</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* About / Bio */}
                                        <td className="p-4 text-xs text-gray-600 dark:text-gray-300 max-w-[200px]">
                                            {agent.about ? (
                                                <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400" title={agent.about}>
                                                    {agent.about}
                                                </p>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">No bio provided</span>
                                            )}
                                        </td>

                                        {/* Status & Applied Date */}
                                        <td className="p-4">
                                            <div className="space-y-1">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${agent.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300' :
                                                    agent.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                        (agent.status === 'rejected' && agent.revokedAt) ? 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300' :
                                                            'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300'
                                                    }`}>
                                                    {agent.status === 'rejected' && agent.revokedAt ? 'REVOKED' : agent.status}
                                                </span>
                                                <p className="text-[10px] text-gray-400">
                                                    {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : 'N/A'}
                                                </p>
                                                {agent.status === 'rejected' && agent.revokedAt && (
                                                    <div className="text-[10px] text-red-500 font-medium">
                                                        {(() => {
                                                            const daysPassed = Math.ceil(Math.abs(new Date() - new Date(agent.revokedAt)) / (1000 * 60 * 60 * 24));
                                                            const daysLeft = 30 - daysPassed;
                                                            return daysLeft > 0 ? `${daysLeft} days freeze` : 'Freeze Ended';
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1.5 items-center">
                                                {/* Inspect Full Application Button */}
                                                <button
                                                    onClick={() => openDetailsModal(agent)}
                                                    className="p-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-lg transition-transform hover:scale-105 shadow-sm text-xs font-semibold flex items-center gap-1"
                                                    title="Inspect Full Application"
                                                >
                                                    <FaFileAlt /> Inspect
                                                </button>

                                                <Link
                                                    to={`/user/agents/${agent._id}`}
                                                    className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-lg transition-transform hover:scale-105 shadow-sm"
                                                    title="View Public Profile"
                                                >
                                                    <FaEye />
                                                </Link>

                                                {agent.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => openApproveModal(agent)}
                                                            className="p-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-300 rounded-lg transition-transform hover:scale-105 shadow-sm"
                                                            title="Approve Application"
                                                        >
                                                            <FaCheck />
                                                        </button>
                                                        <button
                                                            onClick={() => openRejectModal(agent)}
                                                            className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded-lg transition-transform hover:scale-105 shadow-sm"
                                                            title="Reject Application"
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    </>
                                                )}
                                                {agent.status === 'approved' && (
                                                    <button
                                                        onClick={() => openRejectModal(agent)}
                                                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded-lg transition-transform hover:scale-105 shadow-sm text-xs font-semibold flex items-center gap-1"
                                                        title="Revoke Access"
                                                    >
                                                        <FaTimes /> Revoke
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing page <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-semibold dark:text-gray-300">{totalPages}</span>
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            <FaArrowLeft size={12} /> Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            Next <FaArrowRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Application Inspection / Full Details Modal */}
            {showDetailsModal && selectedAgent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 transform transition-all my-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6 border-b dark:border-gray-700 pb-4">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedAgent.photo || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                                    alt={selectedAgent.name}
                                    className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500 shadow-md"
                                />
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        {selectedAgent.name}
                                    </h2>
                                    <p className="text-xs text-gray-500">Agent ID: {selectedAgent._id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg p-1"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Complete Application Fields Grid */}
                        <div className="space-y-6">
                            {/* Status Banner */}
                            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Application Status</span>
                                    <p className="text-sm font-bold uppercase text-gray-800 dark:text-white mt-0.5">
                                        {selectedAgent.status}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Date Submitted</span>
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
                                        {selectedAgent.createdAt ? new Date(selectedAgent.createdAt).toLocaleString() : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Contact Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                                        <FaEnvelope className="text-blue-500 text-xs" /> Email Address
                                    </span>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white break-all">
                                        {selectedAgent.email}
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                                        <FaPhone className="text-green-500 text-xs" /> Mobile Number
                                    </span>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {selectedAgent.mobileNumber}
                                    </p>
                                </div>
                            </div>

                            {/* Professional Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Operating City</span>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                                        <FaMapMarkerAlt className="text-red-500 text-xs" /> {selectedAgent.city}
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Experience</span>
                                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                        {selectedAgent.experience || 0} Years
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">RERA ID</span>
                                    <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                                        {selectedAgent.reraId || 'Not provided'}
                                    </p>
                                </div>
                            </div>

                            {/* Agency Name */}
                            {selectedAgent.agencyName && (
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                                        <FaBuilding className="text-blue-500 text-xs" /> Agency / Brokerage Name
                                    </span>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {selectedAgent.agencyName}
                                    </p>
                                </div>
                            )}

                            {/* Areas Served */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Areas Served</span>
                                {selectedAgent.areas && selectedAgent.areas.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedAgent.areas.map((area, idx) => (
                                            <span key={idx} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg text-xs font-medium">
                                                {area}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">No specific areas specified</p>
                                )}
                            </div>

                            {/* About / Bio Statement */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">About / Bio Statement</span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                                    {selectedAgent.about || "No description provided by the applicant."}
                                </p>
                            </div>

                            {/* Rejection Reason for Non-Root Admins */}
                            {!isRootAdmin && selectedAgent.rejectionReason && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl space-y-1">
                                    <span className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                        <FaExclamationTriangle /> Rejection Reason
                                    </span>
                                    <p className="text-xs text-red-700 dark:text-red-300">
                                        {selectedAgent.rejectionReason}
                                    </p>
                                </div>
                            )}

                            {/* Root Admin Only — Verification Audit Log */}
                            {isRootAdmin && (selectedAgent.status === 'approved' || selectedAgent.status === 'rejected') && (
                                <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 border-2 border-purple-200 dark:border-purple-800/60 rounded-xl space-y-3 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-purple-200/60 dark:border-purple-800/40 pb-2">
                                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <FaUserShield className="text-sm text-purple-600 dark:text-purple-400" /> Admin Action Audit (RootAdmin Only)
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                            selectedAgent.status === 'approved' 
                                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' 
                                                : (selectedAgent.revokedAt 
                                                    ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
                                                    : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800')
                                        }`}>
                                            {selectedAgent.status === 'approved' ? 'Approved' : (selectedAgent.revokedAt ? 'Revoked' : 'Rejected')}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400 block font-medium mb-1">
                                                {selectedAgent.status === 'approved' ? 'Approved By Admin:' : (selectedAgent.revokedAt ? 'Revoked By Admin:' : 'Rejected By Admin:')}
                                            </span>
                                            {selectedAgent.processedBy ? (
                                                <div className="flex items-center gap-2">
                                                    <img 
                                                        src={selectedAgent.processedBy.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"} 
                                                        alt="" 
                                                        className="w-7 h-7 rounded-full object-cover border border-purple-300 dark:border-purple-700 shrink-0" 
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-gray-900 dark:text-white truncate">
                                                                {selectedAgent.processedBy.username || selectedAgent.processedBy.email}
                                                            </span>
                                                            <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold shrink-0">
                                                                {selectedAgent.processedBy.role || 'Admin'}
                                                            </span>
                                                        </div>
                                                        {selectedAgent.processedBy.email && (
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                                {selectedAgent.processedBy.email}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 dark:text-gray-300 font-medium italic block">
                                                    System / Default Admin Action
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400 block font-medium mb-1">Action Date & Time:</span>
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {selectedAgent.processedAt 
                                                    ? new Date(selectedAgent.processedAt).toLocaleString() 
                                                    : (selectedAgent.updatedAt ? new Date(selectedAgent.updatedAt).toLocaleString() : 'N/A')}
                                            </p>
                                            {selectedAgent.rejectionReason && (
                                                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium line-clamp-2" title={selectedAgent.rejectionReason}>
                                                    Reason: "{selectedAgent.rejectionReason}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal Action Buttons */}
                            <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                                <button
                                    onClick={() => setShowDetailsModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                                >
                                    Close
                                </button>

                                {selectedAgent.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setShowDetailsModal(false);
                                                openRejectModal(selectedAgent);
                                            }}
                                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors shadow-md text-sm flex items-center gap-1.5"
                                        >
                                            <FaTimes /> Reject
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowDetailsModal(false);
                                                openApproveModal(selectedAgent);
                                            }}
                                            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-md text-sm flex items-center gap-1.5 shadow-green-500/20"
                                        >
                                            <FaCheck /> Approve Agent
                                        </button>
                                    </>
                                )}

                                {selectedAgent.status === 'approved' && (
                                    <button
                                        onClick={() => {
                                            setShowDetailsModal(false);
                                            openRejectModal(selectedAgent);
                                        }}
                                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors shadow-md text-sm flex items-center gap-1.5"
                                    >
                                        <FaTimes /> Revoke Access
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Approval Confirmation Modal */}
            {showApproveModal && selectedAgent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 mx-auto text-green-600 dark:text-green-400">
                            <FaCheck size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Approve Agent?</h3>
                        <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm">
                            Are you sure you want to approve <strong>{selectedAgent.name}</strong>? They will gain access to agent features immediately.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowApproveModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitApproval}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors shadow-lg shadow-green-500/30"
                            >
                                Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {showRejectModal && selectedAgent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all scale-100">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600 dark:text-red-400">
                            <FaExclamationTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                            {selectedAgent.status === 'approved' ? 'Revoke Access' : 'Reject Application'}
                        </h3>
                        <p className="text-center text-gray-500 dark:text-gray-400 mb-4 text-sm">
                            {selectedAgent.status === 'approved'
                                ? <span>You are regarding to revoke access for <strong>{selectedAgent.name}</strong>.</span>
                                : <span>You are about to reject <strong>{selectedAgent.name}</strong>.</span>
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
                                onClick={submitRejection}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-500/30"
                            >
                                Reject Agent
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none; /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
            `}</style>
        </div>
    );
};

export default AdminAgents;
