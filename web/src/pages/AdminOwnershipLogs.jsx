import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { 
    FaExchangeAlt, 
    FaUserMinus, 
    FaUserCheck, 
    FaSearch, 
    FaHistory, 
    FaShieldAlt, 
    FaFilter, 
    FaCalendarAlt, 
    FaUser, 
    FaBuilding, 
    FaArrowRight, 
    FaInfoCircle,
    FaArrowLeft
} from "react-icons/fa";
import { usePageTitle } from "../hooks/usePageTitle";
import { authenticatedFetch } from "../utils/auth";
import UrbanSetuSpinner from "../components/UrbanSetuSpinner";
import ContactSupportWrapper from "../components/ContactSupportWrapper";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminOwnershipLogs() {
    usePageTitle("Ownership Audit Logs - Admin Management");

    const { currentUser } = useSelector((state) => state.user);

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [actionFilter, setActionFilter] = useState("ALL"); // ALL, TRANSFER, REMOVE, ASSIGN
    const [searchTerm, setSearchTerm] = useState("");

    // Selected Log Modal
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        if (currentUser) {
            fetchOwnershipLogs();
        }
    }, [currentUser?._id]);

    const fetchOwnershipLogs = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/ownership-audit-logs`);
            const data = await res.json();

            if (res.ok && data.success) {
                setLogs(data.data || []);
            } else {
                setError(data.message || "Failed to load ownership audit logs");
            }
        } catch (err) {
            console.error("Error fetching ownership audit logs:", err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Filtered Logs
    const filteredLogs = logs.filter((log) => {
        const matchesAction = actionFilter === "ALL" || log.action === actionFilter;
        
        const term = searchTerm.toLowerCase().trim();
        if (!term) return matchesAction;

        const propName = log.propertyName?.toLowerCase() || "";
        const adminName = log.adminName?.toLowerCase() || "";
        const prevEmail = log.previousOwnerEmail?.toLowerCase() || "";
        const newEmail = log.newOwnerEmail?.toLowerCase() || "";
        const reason = log.reason?.toLowerCase() || "";

        const matchesSearch = 
            propName.includes(term) ||
            adminName.includes(term) ||
            prevEmail.includes(term) ||
            newEmail.includes(term) ||
            reason.includes(term);

        return matchesAction && matchesSearch;
    });

    const getActionBadge = (action) => {
        switch (action) {
            case "TRANSFER":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <FaExchangeAlt className="text-xs" /> TRANSFER
                    </span>
                );
            case "REMOVE":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                        <FaUserMinus className="text-xs" /> REMOVE
                    </span>
                );
            case "ASSIGN":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <FaUserCheck className="text-xs" /> ASSIGN
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {action}
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-purple-500/20 text-2xl">
                            <FaShieldAlt />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                Property Ownership Audit Logs
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                Permanent, immutable record of all property transfers, removals, and assignments.
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/admin/dashboard"
                        className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2"
                    >
                        <FaArrowLeft /> Back to Dashboard
                    </Link>
                </div>

                {/* Search & Action Filter Bar */}
                <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    
                    {/* Action Filter Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-full sm:w-auto overflow-x-auto">
                        {["ALL", "TRANSFER", "REMOVE", "ASSIGN"].map((act) => (
                            <button
                                key={act}
                                onClick={() => setActionFilter(act)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    actionFilter === act
                                        ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 shadow-sm"
                                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                }`}
                            >
                                {act === "ALL" ? "All Logs" : act}
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-80">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search property, admin, email, reason..."
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                        />
                    </div>
                </div>

                {/* Audit Logs Content */}
                {loading ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl shadow-md">
                        <UrbanSetuSpinner />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 font-medium">Fetching permanent audit logs...</p>
                    </div>
                ) : error ? (
                    <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-3xl text-center text-red-600 dark:text-red-400 text-sm">
                        {error}
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl shadow-md border border-gray-100 dark:border-gray-800 space-y-3">
                        <FaHistory className="text-4xl text-gray-300 dark:text-gray-700 mx-auto" />
                        <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No Audit Logs Found</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                            No ownership audit logs match your search filters.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin Authorized</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ownership Flow</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Date & IP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredLogs.map((log) => (
                                        <tr 
                                            key={log._id}
                                            onClick={() => setSelectedLog(log)}
                                            className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition cursor-pointer"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getActionBadge(log.action)}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div>
                                                    <Link 
                                                        to={`/listing/${log.propertyId}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 hover:underline truncate max-w-[180px] block"
                                                    >
                                                        {log.propertyName}
                                                    </Link>
                                                    <span className="text-[10px] text-gray-400 font-mono">
                                                        ID: {log.propertyId}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={log.adminId?.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                                                        alt=""
                                                        className="w-7 h-7 rounded-full object-cover border border-purple-200 dark:border-purple-800"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                                                            {log.adminName}
                                                        </span>
                                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase">
                                                            {log.adminId?.role || 'Admin'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="text-xs space-y-0.5">
                                                    {log.action === "TRANSFER" && (
                                                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                                            <span className="font-semibold text-red-600 dark:text-red-400 truncate max-w-[100px]">
                                                                {log.previousOwnerEmail?.split('@')[0] || 'Previous'}
                                                            </span>
                                                            <FaArrowRight className="text-[10px] text-gray-400" />
                                                            <span className="font-semibold text-green-600 dark:text-green-400 truncate max-w-[100px]">
                                                                {log.newOwnerEmail?.split('@')[0] || 'New Owner'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {log.action === "REMOVE" && (
                                                        <div className="text-red-600 dark:text-red-400 font-semibold truncate max-w-[180px]">
                                                            Removed: {log.previousOwnerEmail || 'Owner'}
                                                        </div>
                                                    )}
                                                    {log.action === "ASSIGN" && (
                                                        <div className="text-green-600 dark:text-green-400 font-semibold truncate max-w-[180px]">
                                                            Assigned: {log.newOwnerEmail || 'New Owner'}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 max-w-[220px]">
                                                <p className="text-xs text-gray-600 dark:text-gray-300 truncate" title={log.reason}>
                                                    {log.reason}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                    {new Date(log.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono">
                                                    {log.ipAddress || 'Unknown IP'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Audit Log Detail Modal */}
                {selectedLog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
                        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <FaShieldAlt className="text-purple-600" /> Audit Log Certificate
                                </h3>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-3 text-xs text-gray-700 dark:text-gray-300">
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl flex items-center justify-between">
                                    <span className="font-bold text-gray-500">Action:</span>
                                    {getActionBadge(selectedLog.action)}
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl space-y-1">
                                    <span className="font-bold text-gray-500 block">Property:</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{selectedLog.propertyName}</span>
                                    <span className="text-[10px] text-gray-400 block font-mono">ID: {selectedLog.propertyId}</span>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl space-y-1">
                                    <span className="font-bold text-gray-500 block">Admin Authorized:</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{selectedLog.adminName}</span>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl space-y-1">
                                    <span className="font-bold text-gray-500 block">Reason:</span>
                                    <p className="italic text-gray-800 dark:text-gray-200">{selectedLog.reason}</p>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl grid grid-cols-2 gap-2 text-[11px]">
                                    <div>
                                        <span className="text-gray-400 block font-semibold">IP Address</span>
                                        <span className="font-mono">{selectedLog.ipAddress}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block font-semibold">Date & Time</span>
                                        <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-2xl transition text-xs"
                            >
                                Close Detail
                            </button>
                        </div>
                    </div>
                )}

            </div>
            <ContactSupportWrapper />
        </div>
    );
}
