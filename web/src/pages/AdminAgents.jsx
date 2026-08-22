import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCheck, FaTimes, FaSearch, FaUserTie, FaArrowLeft, FaArrowRight, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/api';
import { authenticatedFetch } from '../utils/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import AdminAgentsSkeleton from '../components/skeletons/AdminAgentsSkeleton';

const AdminAgents = () => {
    usePageTitle('Manage Agents - UrbanSetu');
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Modals
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [selectedAgent, setSelectedAgent] = useState(null);

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            setLoading(true);
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
            setLoading(false);
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

            if (res.ok) {
                toast.success(`Agent ${status} successfully`);
                fetchAgents(); // Refresh list
            } else {
                toast.error("Failed to update status");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        }
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
        if (!rejectReason.trim()) return toast.warning("Please provide a reason");
        handleUpdateStatus(selectedAgent._id, 'rejected', rejectReason);
        setShowRejectModal(false);
        setSelectedAgent(null);
    };

    const submitApproval = () => {
        handleUpdateStatus(selectedAgent._id, 'approved');
        setShowApproveModal(false);
        setSelectedAgent(null);
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
            (agent.agencyName && agent.agencyName.toLowerCase().includes(searchLower));

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
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <FaUserTie className="text-blue-600" /> Agent Management
                </h1>

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
                            placeholder="Search agents by name, city, or email..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-sm"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider">
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Agent Details</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Location</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Experience</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700">Status</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
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
                                        <td className="p-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div></td>
                                        <td className="p-4"><div className="flex justify-end gap-2"><div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div><div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div></div></td>
                                    </tr>
                                ))
                            ) : paginatedAgents.length === 0 ? (
                                <tr><td colSpan="5" className="p-12 text-center text-gray-500">No agents found matching your criteria.</td></tr>
                            ) : (
                                paginatedAgents.map((agent, index) => (
                                    <tr
                                        key={agent._id}
                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                                        style={{ animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards` }}
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={agent.photo} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200 border-2 border-white dark:border-gray-600 shadow-sm" />
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{agent.name}</p>
                                                    <p className="text-xs text-gray-500">{agent.email} • {agent.mobileNumber}</p>
                                                    {agent.agencyName && <p className="text-xs text-blue-500 font-medium">{agent.agencyName}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                                            <p className="font-medium">{agent.city}</p>
                                            <p className="text-xs text-gray-500 truncate max-w-[150px]" title={agent.areas.join(', ')}>{agent.areas.join(', ')}</p>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-medium">
                                                {agent.experience} Years
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${agent.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300' :
                                                agent.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                    (agent.status === 'rejected' && agent.revokedAt) ? 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300' :
                                                        'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300'
                                                }`}>
                                                {agent.status === 'rejected' && agent.revokedAt ? 'REVOKED' : agent.status}
                                            </span>
                                            {agent.status === 'rejected' && agent.revokedAt && (
                                                <div className="text-xs text-red-500 mt-1 font-medium">
                                                    {(() => {
                                                        const daysPassed = Math.ceil(Math.abs(new Date() - new Date(agent.revokedAt)) / (1000 * 60 * 60 * 24));
                                                        const daysLeft = 30 - daysPassed;
                                                        return daysLeft > 0 ? `${daysLeft} days freeze` : 'Action Required';
                                                    })()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 items-center">
                                                <Link
                                                    to={`/user/agents/${agent._id}`}
                                                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-transform hover:scale-105 shadow-sm"
                                                    title="View Profile & Reviews"
                                                >
                                                    <FaEye />
                                                </Link>

                                                {agent.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => openApproveModal(agent)}
                                                            className="p-2 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-transform hover:scale-105 shadow-sm"
                                                            title="Approve"
                                                        >
                                                            <FaCheck />
                                                        </button>
                                                        <button
                                                            onClick={() => openRejectModal(agent)}
                                                            className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-transform hover:scale-105 shadow-sm"
                                                            title="Reject"
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    </>
                                                )}
                                                {agent.status === 'approved' && (
                                                    <button
                                                        onClick={() => openRejectModal(agent)}
                                                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-transform hover:scale-105 shadow-sm text-xs font-semibold flex items-center gap-1"
                                                        title="Revoke Access"
                                                    >
                                                        <FaTimes /> Revoke
                                                    </button>
                                                )}
                                                {agent.status === 'rejected' && (
                                                    <span className="text-xs text-gray-400 italic">Rejected</span>
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
