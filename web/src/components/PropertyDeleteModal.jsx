import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import {
    FaExclamationTriangle,
    FaLock,
    FaKey,
    FaTrash,
    FaArrowRight,
    FaArrowLeft,
    FaCheckCircle,
    FaTimes,
    FaHistory,
    FaShieldAlt,
    FaBuilding,
    FaEnvelope
} from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { authenticatedFetch } from '../utils/auth';
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from '../redux/user/userSlice';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PropertyDeleteModal({
    isOpen,
    onClose,
    listing,
    onSuccess
}) {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { currentUser } = useSelector((state) => state.user);

    // Step state: 1: Reason, 2: Password, 3: OTP, 4: Final Confirm, 5: Success
    const [step, setStep] = useState(1);

    // Step 1 states
    const [selectedReasonOption, setSelectedReasonOption] = useState('');
    const [customReasonText, setCustomReasonText] = useState('');

    // Step 2 states
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [verifyingPassword, setVerifyingPassword] = useState(false);

    // Step 3 states
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Step 4/5 states
    const [deleting, setDeleting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'rootadmin' || currentUser?.isDefaultAdmin;

    const REASON_OPTIONS = [
        { id: 'Property sold', label: 'Property sold', icon: '🏠' },
        { id: 'Duplicate listing', label: 'Duplicate listing', icon: '📑' },
        { id: 'Wrong information', label: 'Wrong information', icon: '✏️' },
        { id: 'No longer available', label: 'No longer available', icon: '🚫' },
        { id: 'Privacy concerns', label: 'Privacy concerns', icon: '🔒' },
        { id: 'Other', label: 'Other (specify below)', icon: '💬' }
    ];

    useEffect(() => {
        if (!isOpen) {
            resetModal();
        }
    }, [isOpen]);

    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const resetModal = () => {
        setStep(1);
        setSelectedReasonOption('');
        setCustomReasonText('');
        setPassword('');
        setPasswordError('');
        setVerifyingPassword(false);
        setOtp(['', '', '', '', '', '']);
        setOtpError('');
        setSendingOtp(false);
        setVerifyingOtp(false);
        setDeleting(false);
        setIsCompleted(false);
    };

    if (!isOpen || !listing) return null;

    const getFinalReason = () => {
        if (selectedReasonOption === 'Other') {
            return customReasonText.trim() ? `Other: ${customReasonText.trim()}` : 'Other';
        }
        return selectedReasonOption;
    };

    // Step 1 -> Step 2
    const handleReasonSubmit = (e) => {
        e.preventDefault();
        if (!selectedReasonOption) {
            toast.error('Please select a reason for deleting this property');
            return;
        }
        if (selectedReasonOption === 'Other' && !customReasonText.trim()) {
            toast.error('Please specify the reason in the text box');
            return;
        }
        setStep(2);
    };

    // Step 2 Password Verification -> Auto Trigger OTP -> Step 3
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!password) {
            setPasswordError('Password is required');
            return;
        }

        setVerifyingPassword(true);
        setPasswordError('');

        try {
            const verifyRes = await authenticatedFetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (!verifyRes.ok) {
                const key = 'deleteListingPwAttempts';
                const prev = parseInt(localStorage.getItem(key) || '0');
                const next = prev + 1;
                localStorage.setItem(key, String(next));

                if (next >= 3) {
                    toast.error("Too many incorrect password attempts. Signed out for security.");
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
                    localStorage.removeItem(key);
                    onClose();
                    navigate('/sign-in');
                    return;
                }

                const remaining = 3 - next;
                setPasswordError(`Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`);
                setVerifyingPassword(false);
                return;
            }

            localStorage.removeItem('deleteListingPwAttempts');

            // Password valid -> Send OTP
            await triggerSendOtp();
            setStep(3);
        } catch (err) {
            setPasswordError('Error verifying password. Please try again.');
        } finally {
            setVerifyingPassword(false);
        }
    };

    const triggerSendOtp = async () => {
        setSendingOtp(true);
        setOtpError('');
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/send-delete-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listingId: listing._id })
            });

            const data = await res.json();
            if (res.ok) {
                toast.info(`Security OTP sent to ${currentUser.email}`);
                setResendCooldown(30);
            } else {
                setOtpError(data.message || 'Failed to send OTP email.');
                toast.error(data.message || 'Failed to send OTP.');
            }
        } catch (err) {
            setOtpError('Failed to send OTP. Please check your network.');
        } finally {
            setSendingOtp(false);
        }
    };

    // OTP Digit Change Handler
    const handleOtpChange = (index, value) => {
        if (value.length > 1) {
            value = value.slice(-1);
        }
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto advance to next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`delete-otp-input-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`delete-otp-input-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    // Step 3 OTP Submit -> Step 4
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        const otpCode = otp.join('');
        if (otpCode.length < 6) {
            setOtpError('Please enter the full 6-digit OTP code');
            return;
        }

        setVerifyingOtp(true);
        setOtpError('');

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/verify-delete-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listingId: listing._id,
                    otp: otpCode
                })
            });

            const data = await res.json();
            if (res.ok) {
                setStep(4);
            } else {
                setOtpError(data.message || 'Invalid OTP code.');
            }
        } catch (err) {
            setOtpError('Error verifying OTP code. Please try again.');
        } finally {
            setVerifyingOtp(false);
        }
    };

    // Step 4 Final Delete Confirm -> Execution & Step 5
    const handleFinalDeleteConfirm = async () => {
        setDeleting(true);
        const finalReason = getFinalReason();

        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/delete/${listing._id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: finalReason,
                    otp: otp.join('')
                })
            });

            const data = await res.json();
            if (res.ok) {
                setIsCompleted(true);
                setStep(5);
                if (onSuccess) onSuccess(listing._id);
            } else {
                toast.error(data.message || 'Failed to delete listing.');
            }
        } catch (err) {
            toast.error('Network error during deletion.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl w-full max-w-lg shadow-2xl border border-red-500/20 dark:border-red-900/30 overflow-hidden flex flex-col transition-all duration-300 transform zoom-in-95">

                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-6 relative flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
                            <FaTrash className="text-xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold tracking-tight">Delete Property</h3>
                            <p className="text-xs text-red-100 font-medium">30-Day Trash & Soft-Delete Security Flow</p>
                        </div>
                    </div>
                    {!isCompleted && (
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-all"
                        >
                            <FaTimes />
                        </button>
                    )}
                </div>

                {/* Step Progress Bar */}
                {!isCompleted && (
                    <div className="px-6 pt-4 pb-2 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                            <span className={step >= 1 ? 'text-red-600 dark:text-red-400' : ''}>1. Reason</span>
                            <span className={step >= 2 ? 'text-red-600 dark:text-red-400' : ''}>2. Password</span>
                            <span className={step >= 3 ? 'text-red-600 dark:text-red-400' : ''}>3. OTP</span>
                            <span className={step >= 4 ? 'text-red-600 dark:text-red-400' : ''}>4. Confirm</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-red-600 h-full transition-all duration-300 rounded-full"
                                style={{ width: `${(step / 4) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">

                    {/* STEP 1: Reason Selection */}
                    {step === 1 && (
                        <form onSubmit={handleReasonSubmit} className="space-y-5 animate-fade-in">
                            {/* High Risk Consequences Card */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3 text-amber-900 dark:text-amber-200">
                                <FaExclamationTriangle className="text-amber-500 text-xl flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-sm">High-Risk Action Notice</h4>
                                    <p className="text-xs mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                                        Deleting <strong className="text-gray-900 dark:text-white">"{listing.name}"</strong> will remove it from public search, cancel pending appointments, and hide reviews & analytics.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">
                                    Why are you deleting this property? <span className="text-red-500">*</span>
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {REASON_OPTIONS.map((opt) => (
                                        <button
                                            type="button"
                                            key={opt.id}
                                            onClick={() => setSelectedReasonOption(opt.id)}
                                            className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${selectedReasonOption === opt.id
                                                    ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300 font-bold shadow-sm'
                                                    : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <span className="text-lg">{opt.icon}</span>
                                            <span className="text-xs font-semibold">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {selectedReasonOption === 'Other' && (
                                    <div className="mt-3 animate-fade-in">
                                        <textarea
                                            value={customReasonText}
                                            onChange={(e) => setCustomReasonText(e.target.value)}
                                            placeholder="Please specify your reason for deletion..."
                                            rows={2}
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none text-gray-800 dark:text-white resize-none"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedReasonOption || (selectedReasonOption === 'Other' && !customReasonText.trim())}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-200 dark:shadow-none"
                                >
                                    Next: Verify Identity <FaArrowRight className="text-xs" />
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STEP 2: Password Re-Authentication */}
                    {step === 2 && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-5 animate-fade-in">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-red-600 dark:text-red-400">
                                    <FaLock className="text-2xl" />
                                </div>
                                <h4 className="font-bold text-lg text-gray-900 dark:text-white">Re-Authenticate Identity</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Enter your UrbanSetu password to verify authorized ownership.
                                </p>
                            </div>

                            {passwordError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl text-xs font-semibold text-red-600 dark:text-red-400 text-center">
                                    {passwordError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your current password"
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none text-gray-900 dark:text-white transition"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2"
                                >
                                    <FaArrowLeft className="text-xs" /> Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={!password || verifyingPassword}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-200 dark:shadow-none"
                                >
                                    {verifyingPassword ? <UrbanSetuSpinner size="sm" isBright={true} /> : <>Verify & Send OTP <FaKey className="text-xs" /></>}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STEP 3: OTP Verification */}
                    {step === 3 && (
                        <form onSubmit={handleOtpSubmit} className="space-y-5 animate-fade-in">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
                                    <FaEnvelope className="text-2xl" />
                                </div>
                                <h4 className="font-bold text-lg text-gray-900 dark:text-white">Security OTP Sent</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    We sent a 6-digit verification code to <strong className="text-blue-600 dark:text-blue-400">{currentUser.email}</strong>.
                                </p>
                            </div>

                            {otpError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl text-xs font-semibold text-red-600 dark:text-red-400 text-center">
                                    {otpError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 text-center mb-3">
                                    Enter 6-Digit OTP Code
                                </label>
                                <div className="flex justify-center gap-2">
                                    {otp.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            id={`delete-otp-input-${idx}`}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                            className="w-11 h-12 text-center text-xl font-bold bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-900 dark:text-white shadow-sm"
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={triggerSendOtp}
                                    disabled={sendingOtp || resendCooldown > 0}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                                >
                                    {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : sendingOtp ? 'Sending...' : 'Resend Code via Email'}
                                </button>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2"
                                >
                                    <FaArrowLeft className="text-xs" /> Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={otp.join('').length < 6 || verifyingOtp}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-200 dark:shadow-none"
                                >
                                    {verifyingOtp ? <UrbanSetuSpinner size="sm" isBright={true} /> : <>Verify OTP <FaArrowRight className="text-xs" /></>}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STEP 4: Final Warning Screen */}
                    {step === 4 && (
                        <div className="space-y-5 animate-fade-in text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                                <FaShieldAlt className="text-3xl" />
                            </div>

                            <div>
                                <h4 className="font-extrabold text-xl text-gray-900 dark:text-white">Confirm Property Soft-Delete</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    You are authorized to soft-delete this listing.
                                </p>
                            </div>

                            {/* Property Preview Pill */}
                            <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 text-left">
                                <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
                                    {listing.imageUrls?.[0] ? (
                                        <img src={listing.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <FaBuilding />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h5 className="font-bold text-gray-900 dark:text-white text-sm truncate">{listing.name}</h5>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{listing.address}</p>
                                    <span className="inline-block mt-1 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded-md">
                                        Reason: {getFinalReason()}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 text-left text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
                                <p className="font-bold flex items-center gap-1.5">
                                    <FaHistory className="text-amber-600" /> 30-Day Trash Policy:
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-amber-800 dark:text-amber-300">
                                    <li>Listing will be hidden from public search immediately.</li>
                                    <li>Stored in Trash for 30 days.</li>
                                    <li>Can be restored anytime from <strong>My Deleted Listings</strong>.</li>
                                    <li>Confirmation & restore token email will be sent.</li>
                                </ul>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFinalDeleteConfirm}
                                    disabled={deleting}
                                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-red-300 dark:shadow-none"
                                >
                                    {deleting ? <UrbanSetuSpinner size="sm" isBright={true} /> : <>Confirm & Move to Trash</>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Success & Completion Screen */}
                    {step === 5 && (
                        <div className="space-y-6 animate-fade-in text-center py-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-400 shadow-lg shadow-green-100 dark:shadow-none">
                                <FaCheckCircle className="text-4xl" />
                            </div>

                            <div>
                                <h4 className="font-black text-2xl text-gray-900 dark:text-white">Property Moved to Trash</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    <strong>"{listing.name}"</strong> has been soft-deleted successfully.
                                </p>
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-2xl text-xs text-green-800 dark:text-green-300 space-y-2">
                                <p className="font-bold text-sm">📅 30 Days Retention Window</p>
                                <p>
                                    You can restore this property from Trash anytime during the next 30 days. An automated email with restoration details has been sent to <strong>{currentUser.email}</strong>.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        navigate(isAdmin ? '/admin/deleted-listings' : '/user/deleted-listings');
                                    }}
                                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
                                >
                                    <FaHistory /> Go to Deleted Properties
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="py-3.5 px-6 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
