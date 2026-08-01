import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FaTrash, FaUndo, FaSearch, FaUser, FaUserShield, FaCalendarAlt, FaExclamationTriangle, FaArrowLeft } from "react-icons/fa";
import ContactSupportWrapper from "../components/ContactSupportWrapper";
import MyDeletedListingsSkeleton from "../components/skeletons/MyDeletedListingsSkeleton";
import UrbanSetuSpinner from "../components/UrbanSetuSpinner";

import { usePageTitle } from "../hooks/usePageTitle";
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MyDeletedListings() {
    usePageTitle("Deleted Properties - My Listings");

    const { currentUser } = useSelector((state) => state.user);
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        searchTerm: '',
    });

    const [restoringId, setRestoringId] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedListingToRestore, setSelectedListingToRestore] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (currentUser) {
            fetchDeletedListings();
        }
    }, [currentUser?._id, filters]);

    // Reset pagination when filters change (already triggered by dependency above re-fetching, 
    // but if we want client-side pagination on fetched data, we reset page here)
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const fetchDeletedListings = async () => {
        try {
            setLoading(true);
            setError(null);

            const queryParams = new URLSearchParams();
            if (filters.searchTerm) queryParams.append('searchTerm', filters.searchTerm);
            queryParams.append('limit', '100'); // Fetch more to handle client-side pagination smoothly for now

            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/user/get-deleted?${queryParams.toString()}`);

            const data = await res.json();

            if (data.success) {
                setListings(data.data);
            } else {
                setError(data.message || 'Failed to fetch deleted listings');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreClick = (listing) => {
        setSelectedListingToRestore(listing);
        setShowConfirmModal(true);
    };

    const confirmRestore = async () => {
        if (!selectedListingToRestore) return;
        const id = selectedListingToRestore._id;
        try {
            setRestoringId(id);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/restore-deleted/${id}`, {
                method: 'POST',
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Listing restored successfully!");
                setListings(prev => prev.filter(item => item._id !== id));
                setShowConfirmModal(false);
            } else {
                toast.error(data.message || "Failed to restore listing");
            }
        } catch (err) {
            toast.error("An error occurred while restoring");
        } finally {
            setRestoringId(null);
            setShowConfirmModal(false);
            setSelectedListingToRestore(null);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getDaysRemaining = (expiryDate) => {
        if (!expiryDate) return null;
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    // Pagination Logic
    const totalPages = Math.ceil(listings.length / itemsPerPage) || 1;
    const displayedListings = listings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col relative transition-colors duration-300">
            <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <FaTrash className="text-red-500" />
                            My Deleted Listings
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">View and restore your deleted properties</p>
                    </div>
                    <Link
                        to="/user/my-listings"
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium flex items-center gap-2"
                    >
                        <FaArrowLeft /> Back to My Listings
                    </Link>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6 transition-colors duration-300">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <FaSearch className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by property name or address..."
                                value={filters.searchTerm}
                                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <MyDeletedListingsSkeleton />
                ) : error ? (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-8 rounded-xl text-center">
                        <FaExclamationTriangle className="mx-auto text-4xl mb-4 opacity-50" />
                        <p className="text-lg font-medium">{error}</p>
                        <button
                            onClick={fetchDeletedListings}
                            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                            Try Again
                        </button>
                    </div>
                ) : listings.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center transition-colors duration-300">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FaTrash className="text-gray-400 dark:text-gray-500 text-3xl" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Deleted Listings Found</h3>
                        <p className="text-gray-500 dark:text-gray-400">You don't have any deleted listings.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300 flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deleted Info</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Restoration</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {displayedListings.map((item, index) => (
                                        <tr
                                            key={item._id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                            style={{ animation: `fadeIn 0.2s ease-out ${index * 0.05}s backwards` }}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                                                        {item.listingData.imageUrls?.[0] ? (
                                                            <img
                                                                src={item.listingData.imageUrls[0]}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                <FaCalendarAlt />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <Link
                                                            to={`/listing/${item.originalListingId}`}
                                                            target="_blank"
                                                            className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px] hover:text-blue-600 hover:underline block"
                                                            title={item.listingData.name}
                                                        >
                                                            {item.listingData.name}
                                                        </Link>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                                            {item.listingData.address}
                                                        </div>
                                                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                                                            {item.listingData.type === 'rent' ? 'For Rent' : 'For Sale'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded text-xs font-semibold ${item.deletionType === 'admin'
                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                                        }`}>
                                                        {item.deletionType === 'admin' ? <FaUserShield className="text-[10px]" /> : <FaUser className="text-[10px]" />}
                                                        {item.deletionType === 'admin' ? 'Deleted by Admin' : 'Deleted by You'}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {formatDate(item.deletedAt)}
                                                    </span>
                                                    {item.deletionReason && (
                                                        <div className="text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-1.5 rounded-lg mt-1 text-red-800 dark:text-red-300 font-medium max-w-[220px]" title={item.deletionReason}>
                                                            <span className="font-bold text-red-600 dark:text-red-400">Reason:</span> {item.deletionReason}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.tokenExpiry && (!item.deletionType || item.deletionType === 'owner') ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-xs font-medium ${getDaysRemaining(item.tokenExpiry) < 5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                            {getDaysRemaining(item.tokenExpiry)} days remaining
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                            Expires: {new Date(item.tokenExpiry).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                                        {item.deletionType === 'admin' ? 'Contact Support to Restore' : 'Cannot Auto-Restore'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {(item.deletionType !== 'admin' || !item.deletionType) && (
                                                    <button
                                                        onClick={() => handleRestoreClick(item)}
                                                        disabled={restoringId === item._id}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                                    >
                                                        {restoringId === item._id ? (
                                                            <UrbanSetuSpinner size="sm" />
                                                        ) : (
                                                            <FaUndo />
                                                        )}
                                                        Restore
                                                    </button>
                                                )}
                                                {item.deletionType === 'admin' && (
                                                    <button
                                                        disabled
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                                                        title="Only admins can restore properties they deleted"
                                                    >
                                                        <FaUserShield /> Admin Action Required
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Showing page <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-semibold dark:text-gray-300">{totalPages}</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <FaArrowLeft size={12} /> Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next <span style={{ transform: 'rotate(180deg)' }}><FaArrowLeft size={12} /></span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Restore Confirmation Modal */}
            {showConfirmModal && selectedListingToRestore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
                        <div className="p-6">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaUndo className="text-green-600 dark:text-green-400 text-2xl" />
                            </div>

                            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                                Restore Property?
                            </h3>

                            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
                                You are about to restore <strong>{selectedListingToRestore.listingData.name}</strong>.
                                <br /><br />
                                This will make the property active again on the platform.
                            </p>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmRestore}
                                    disabled={restoringId !== null}
                                    className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-green-200 dark:shadow-none flex justify-center items-center gap-2"
                                >
                                    {restoringId !== null ? (
                                        <UrbanSetuSpinner size="sm" isBright={true} />
                                    ) : (
                                        <>Restore Property</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ContactSupportWrapper />
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
