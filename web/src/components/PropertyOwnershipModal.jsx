import React, { useState, useEffect } from 'react';
import { 
    FaUserCheck, 
    FaUserMinus, 
    FaExchangeAlt, 
    FaLock, 
    FaExclamationTriangle, 
    FaCheckCircle, 
    FaSearch, 
    FaShieldAlt, 
    FaHistory, 
    FaArrowLeft, 
    FaArrowRight, 
    FaUser, 
    FaEnvelope, 
    FaPhone, 
    FaTimes,
    FaEye,
    FaEyeSlash
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PropertyOwnershipModal({
    isOpen,
    onClose,
    mode = 'transfer', // 'transfer', 'remove', 'assign'
    listing,
    currentOwner,
    onSuccess
}) {
    if (!isOpen || !listing) return null;

    // Steps state
    const [step, setStep] = useState(1);
    
    // User search & selection state
    const [searchTerm, setSearchTerm] = useState('');
    const [availableUsers, setAvailableUsers] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Form inputs
    const [reason, setReason] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Submission states
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Fetch user autocomplete list when search term changes or modal opens
    useEffect(() => {
        if (mode === 'transfer' || mode === 'assign') {
            fetchUsers(searchTerm);
        }
    }, [searchTerm, mode]);

    // Reset modal state on open
    useEffect(() => {
        setStep(1);
        setSearchTerm('');
        setSelectedUser(null);
        setReason('');
        setPassword('');
        setErrorMessage('');
    }, [isOpen, mode]);

    const fetchUsers = async (query = '') => {
        try {
            setSearchingUsers(true);
            const res = await authenticatedFetch(`${API_BASE_URL}/api/user/all-users-autocomplete?query=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                // Filter out current owner from transfer search list
                const filtered = data.filter(u => u._id !== currentOwner?._id);
                setAvailableUsers(filtered);
            }
        } catch (err) {
            console.error('Error searching users:', err);
        } finally {
            setSearchingUsers(false);
        }
    };

    const handleNext = () => {
        setErrorMessage('');

        if (mode === 'transfer') {
            if (step === 1 && !selectedUser) {
                setErrorMessage('Please select a target user to transfer ownership');
                return;
            }
            if (step === 2 && !reason.trim()) {
                setErrorMessage('Reason for ownership transfer is required');
                return;
            }
            setStep(prev => prev + 1);
        } else if (mode === 'remove') {
            if (step === 1 && !reason.trim()) {
                setErrorMessage('Reason for removing ownership is required');
                return;
            }
            setStep(prev => prev + 1);
        } else if (mode === 'assign') {
            if (step === 1 && !selectedUser) {
                setErrorMessage('Please select a user to assign property ownership');
                return;
            }
            setStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        setErrorMessage('');
        setStep(prev => Math.max(1, prev - 1));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!password) {
            setErrorMessage('Admin password is required');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
            let endpoint = '';
            let payload = {};

            if (mode === 'transfer') {
                endpoint = `${API_BASE_URL}/api/listing/transfer-owner/${listing._id}`;
                payload = { newOwnerId: selectedUser._id, reason: reason.trim(), password };
            } else if (mode === 'remove') {
                endpoint = `${API_BASE_URL}/api/listing/deassign-owner/${listing._id}`;
                payload = { reason: reason.trim(), password };
            } else if (mode === 'assign') {
                endpoint = `${API_BASE_URL}/api/listing/reassign-owner/${listing._id}`;
                payload = { newOwnerId: selectedUser._id, reason: reason.trim() || 'Assigned by admin', password };
            }

            const res = await authenticatedFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Operation failed');
            }

            toast.success(data.message || 'Property ownership updated successfully');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Ownership Operation Error:', err);
            setErrorMessage(err.message || 'Failed to complete ownership operation');
        } finally {
            setLoading(false);
        }
    };

    // Calculate maximum steps for mode
    const totalSteps = mode === 'transfer' ? 4 : mode === 'remove' ? 3 : 3;

    // Config per mode
    const modeConfig = {
        transfer: {
            title: 'Transfer Property Ownership',
            subtitle: 'Directly move ownership from current owner to a new user',
            icon: <FaExchangeAlt className="text-purple-600 dark:text-purple-400" />,
            badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
        },
        remove: {
            title: 'Remove Property Owner',
            subtitle: 'Unassign current owner & change status to unassigned',
            icon: <FaUserMinus className="text-red-600 dark:text-red-400" />,
            badgeBg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        },
        assign: {
            title: 'Assign New Owner',
            subtitle: 'Grant property management permissions to a registered user',
            icon: <FaUserCheck className="text-blue-600 dark:text-blue-400" />,
            badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        }
    };

    const config = modeConfig[mode] || modeConfig.transfer;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-xl max-h-[94vh] sm:max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all">
                
                {/* Header */}
                <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 sm:p-3 rounded-2xl ${config.badgeBg} text-lg sm:text-xl`}>
                            {config.icon}
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {config.title}
                            </h3>
                            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                                {config.subtitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="flex-shrink-0 px-4 sm:px-6 pt-3 sm:pt-4 pb-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/60">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                        <span>Step {step} of {totalSteps}</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                            {mode === 'transfer' ? (
                                step === 1 ? '1. Select User' : step === 2 ? '2. Enter Reason' : step === 3 ? '3. Review Summary' : '4. Confirm Password'
                            ) : mode === 'remove' ? (
                                step === 1 ? '1. Enter Reason' : step === 2 ? '2. Warning Notice' : '3. Confirm Password'
                            ) : (
                                step === 1 ? '1. Select User' : step === 2 ? '2. Review Summary' : '3. Confirm Password'
                            )}
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300 rounded-full"
                            style={{ width: `${(step / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                    <div className="mx-4 sm:mx-6 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                        <FaExclamationTriangle className="flex-shrink-0 text-sm" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

                    {/* MODE: TRANSFER or ASSIGN - STEP 1: SELECT USER */}
                    {(mode === 'transfer' || mode === 'assign') && step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                    Search New Owner
                                </label>
                                <div className="relative">
                                    <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by name, email, or mobile..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                                    />
                                </div>
                            </div>

                            {/* User Selection List */}
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {(() => {
                                    const term = searchTerm.toLowerCase().trim();
                                    const filteredUsers = availableUsers.filter((u) => {
                                        if (!term) return true;
                                        const name = (u.username || u.name || '').toLowerCase();
                                        const email = (u.email || '').toLowerCase();
                                        const mobile = (u.mobileNumber || '').toLowerCase();
                                        return name.includes(term) || email.includes(term) || mobile.includes(term);
                                    });

                                    if (searchingUsers) {
                                        return (
                                            <div className="text-center py-6 text-xs text-gray-400">
                                                Searching users...
                                            </div>
                                        );
                                    }

                                    if (filteredUsers.length === 0) {
                                        return (
                                            <div className="text-center py-6 text-xs text-gray-400">
                                                No users found matching search criteria.
                                            </div>
                                        );
                                    }

                                    return filteredUsers.map((u) => {
                                        const isSuspended = u.status === 'suspended' || u.status === 'banned';
                                        const isUnverified = u.isVerified === false;
                                        const isDisabled = isSuspended || isUnverified;

                                        return (
                                            <div
                                                key={u._id}
                                                onClick={() => {
                                                    if (!isDisabled) setSelectedUser(u);
                                                }}
                                                className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                                                    selectedUser?._id === u._id
                                                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20 shadow-sm'
                                                        : isDisabled
                                                        ? 'border-gray-200 dark:border-gray-800 opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/40'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-400 bg-white dark:bg-gray-800'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={u.avatar || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                                                        alt={u.username}
                                                        className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                                                                {u.username || u.name}
                                                            </span>
                                                            {isSuspended && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded font-semibold">
                                                                    Suspended
                                                                </span>
                                                            )}
                                                            {isUnverified && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded font-semibold">
                                                                    Unverified
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                            {u.email} {u.mobileNumber ? `• ${u.mobileNumber}` : ''}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="selectedUser"
                                                        checked={selectedUser?._id === u._id}
                                                        disabled={isDisabled}
                                                        onChange={() => {}}
                                                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                                    />
                                                </div>
                                            </div>
                                        );
                                     });
                                })()}
                            </div>
                        </div>
                    )}

                    {/* MODE: TRANSFER - STEP 2 OR MODE: REMOVE - STEP 1: REASON */}
                    {((mode === 'transfer' && step === 2) || (mode === 'remove' && step === 1)) && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                    Reason for Action <span className="text-red-500">*</span>
                                </label>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                                    This note will be recorded in the audit log and shared with affected users via email notification.
                                </p>
                                <textarea
                                    rows={4}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder={
                                        mode === 'transfer' 
                                            ? "Example: Ownership transferred after verification of sales agreement." 
                                            : "Example: Owner unresponsive to tenant support despite repeated reminders."
                                    }
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition resize-none"
                                />
                            </div>

                            {/* Preset Reason Quick Buttons */}
                            <div>
                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-2">Quick Presets:</span>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        "Ownership transferred after sales agreement",
                                        "Account migration & authorization",
                                        "Violation of community policy",
                                        "Unresponsive owner account",
                                        "Duplicate or test account cleanup"
                                    ].map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setReason(preset)}
                                            className="text-[11px] px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-gray-700 dark:text-gray-300 rounded-lg transition"
                                        >
                                            + {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODE: REMOVE - STEP 2: WARNING SCREEN */}
                    {mode === 'remove' && step === 2 && (
                        <div className="space-y-4">
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-2xl">
                                <h4 className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
                                    <FaExclamationTriangle className="text-base" /> High-Risk Administrative Action Notice
                                </h4>
                                <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed mb-3">
                                    Removing ownership will unassign <strong>"{listing.name}"</strong> immediately. Please review consequences:
                                </p>
                                <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-300 font-medium">
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        <span>Current owner will lose all edit and delete access to this property.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 mt-0.5">•</span>
                                        <span>Existing tenant appointments and chat history remain preserved.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span>Property status becomes <strong>"Unassigned"</strong> until a new owner is assigned.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-purple-500 mt-0.5">•</span>
                                        <span>Permanent entry will be recorded in the <strong>Ownership Audit Log</strong>.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* MODE: TRANSFER (STEP 3) or MODE: ASSIGN (STEP 2): SUMMARY REVIEW */}
                    {((mode === 'transfer' && step === 3) || (mode === 'assign' && step === 2)) && (
                        <div className="space-y-4">
                            <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                                Ownership Transfer Summary
                            </div>

                            {/* Property Card */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                                <img
                                    src={listing.imageUrls?.[0] || 'https://via.placeholder.com/150'}
                                    alt=""
                                    className="w-12 h-12 rounded-xl object-cover"
                                />
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate max-w-[240px]">
                                        {listing.name}
                                    </h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[240px]">
                                        {listing.address}
                                    </p>
                                </div>
                            </div>

                            {/* Owner Comparison Card */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {mode === 'transfer' && (
                                    <div className="p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl">
                                        <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Previous Owner</span>
                                        <div className="mt-1 text-xs font-bold text-gray-900 dark:text-white truncate">
                                            {currentOwner?.username || currentOwner?.name || 'Unassigned'}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                            {currentOwner?.email || 'N/A'}
                                        </div>
                                    </div>
                                )}

                                <div className="p-3 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl col-span-1 sm:col-span-1">
                                    <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">New Owner</span>
                                    <div className="mt-1 text-xs font-bold text-gray-900 dark:text-white truncate">
                                        {selectedUser?.username || selectedUser?.name}
                                    </div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                        {selectedUser?.email}
                                    </div>
                                </div>
                            </div>

                            {/* Granted Permissions List */}
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30 rounded-2xl text-xs space-y-1.5">
                                <span className="font-bold text-purple-900 dark:text-purple-300 block mb-1">
                                    New Owner Granted Permissions:
                                </span>
                                <div className="grid grid-cols-2 gap-1 text-[11px] text-purple-800 dark:text-purple-300">
                                    <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> Edit Permission</span>
                                    <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> Delete Permission</span>
                                    <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> Appointments</span>
                                    <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> Analytics</span>
                                    <span className="flex items-center gap-1 col-span-2"><FaCheckCircle className="text-green-500" /> Agent Management</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LAST STEP: ADMIN PASSWORD VERIFICATION */}
                    {step === totalSteps && (
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 text-center">
                                <FaShieldAlt className="text-3xl text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                                <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                                    Re-authenticate Admin Password
                                </h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    Please enter your logged-in Admin account password to authorize this action.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                                    Admin Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password..."
                                        className="w-full pr-10 pl-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                <FaHistory className="flex-shrink-0 text-blue-600" />
                                <span>Action will be logged with your Admin ID, IP address, and timestamp.</span>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Navigation Buttons */}
                <div className="flex-shrink-0 p-4 sm:p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-3">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={loading}
                            className="px-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition text-xs sm:text-sm flex items-center gap-1.5"
                        >
                            <FaArrowLeft className="text-xs" /> Back
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition text-xs sm:text-sm"
                        >
                            Cancel
                        </button>
                    )}

                    {step < totalSteps ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-2xl transition shadow-lg shadow-purple-500/20 text-xs sm:text-sm flex items-center gap-1.5"
                        >
                            Next Step <FaArrowRight className="text-xs" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || !password}
                            className="px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl transition shadow-lg shadow-purple-500/25 disabled:opacity-50 text-xs sm:text-sm flex items-center gap-2"
                        >
                            {loading ? 'Processing...' : 'Confirm Action'}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
