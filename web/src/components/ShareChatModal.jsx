import React, { useState, useEffect } from 'react';
import { FaShareAlt, FaCopy, FaTrash, FaClock, FaCheck, FaTimes, FaGlobe, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';
import SocialSharePanel from './SocialSharePanel';

export default function ShareChatModal({ isOpen, onClose, sessionId, currentChatName, themeColors }) {
    const [loading, setLoading] = useState(false);
    const [shareData, setShareData] = useState(null);
    const [expiryType, setExpiryType] = useState('30days');
    const [customTitle, setCustomTitle] = useState(currentChatName || '');
    const [copied, setCopied] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

    useEffect(() => {
        if (isOpen) {
            // Priority: existing share data (handled in fetch) > current dynamic AI title > fallback
            setCustomTitle(currentChatName && currentChatName !== "New Chat" ? currentChatName : 'Shared Chat');
            if (sessionId) {
                fetchShareInfo();
            }
        } else {
            // Clean up when closed to avoid stale data flashing on next open
            setShareData(null);
            setShowRevokeConfirm(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, sessionId, currentChatName]);

    const fetchShareInfo = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/manage/${sessionId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success && data.sharedChat) {
                setShareData(data.sharedChat);
                setCustomTitle(data.sharedChat.title);
                // Deduce expiry type logic if needed, but simple is fine
            } else {
                setShareData(null);
            }
        } catch (error) {
            console.error('Error fetching share info:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLink = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    title: customTitle,
                    expiresType: expiryType
                })
            });
            const data = await res.json();
            if (data.success) {
                setShareData(data.sharedChat);
                toast.success("Link generated successfully!");
            } else {
                toast.error(data.message || "Failed to generate link");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

    const handleRevokeLink = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/${shareData.shareToken}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                setShareData(null);
                setShowRevokeConfirm(false);
                toast.success("Link revoked successfully");
                onClose();
            } else {
                toast.error(data.message || "Failed to revoke");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/api/shared-chat/${shareData.shareToken}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: customTitle,
                    expiresType: expiryType,
                    isActive: shareData.isActive
                })
            });
            const data = await res.json();
            if (data.success) {
                if (data.message === 'Link is up to date') {
                    toast.info(data.message);
                } else {
                    toast.success(data.message);
                }
                fetchShareInfo(); // Refresh
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Failed to update");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!shareData) return;
        const url = `${window.location.origin}${shareData.url}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Link copied!");
    };

    const [showSocialPanel, setShowSocialPanel] = useState(false);

    // ... (existing copy logic)

    const handleSocialShare = () => {
        if (!shareData) return;
        setShowSocialPanel(true);
    };

    const getRemainingDays = () => {
        if (!shareData?.expiresAt) return null;
        const today = new Date();
        const expiresAt = new Date(shareData.expiresAt);
        const diffTime = expiresAt - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                <div className={`bg-gradient-to-r ${themeColors?.primary || 'from-blue-600 to-purple-600'} p-6 text-white flex justify-between items-center`}>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FaShareAlt /> Share Chat
                    </h3>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchShareInfo} className="hover:bg-white/20 p-2 rounded-full transition-colors" title="Refresh Views">
                            <FaSync />
                        </button>
                        <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                            <FaTimes />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {loading && !shareData && (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${themeColors ? themeColors.accent.replace('text-', 'border-') : 'border-blue-600'}`}></div>
                            <span className="text-gray-500 text-sm font-medium">Verifying Link Status...</span>
                        </div>
                    )}

                    {!loading && !shareData && (
                        <>
                            <div className="text-center space-y-2">
                                <div className={`${themeColors?.secondary || 'bg-blue-50'} dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-gray-700`}>
                                    <FaGlobe className={`${themeColors?.accent || 'text-blue-500'} dark:text-gray-300 text-3xl`} />
                                </div>
                                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Share this conversation</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Create a public link to share this chat. Anyone with the link will be able to view the messages.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chat Title (Public)</label>
                                    <input
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 ${themeColors ? themeColors.accent.replace('text-', 'focus:ring-').replace(/500|600/g, '500') : 'focus:ring-blue-500'} focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 transition-colors`}
                                        placeholder="Enter a title for the shared chat"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link Expiry</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['7days', '30days', 'never'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setExpiryType(type)}
                                                className={`py-2 text-sm rounded-lg border transition-all ${expiryType === type
                                                    ? `${themeColors?.secondary || 'bg-blue-50'} ${themeColors ? themeColors.accent.replace('text-', 'border-') : 'border-blue-500'} ${themeColors ? themeColors.accent.replace(/500|600/g, '700') : 'text-blue-700'} font-medium ${themeColors ? `dark:${themeColors.accent.replace('text-', 'bg-').replace(/500|600/g, '900')}/30 dark:${themeColors.accent.replace('text-', 'border-')} dark:${themeColors.accent.replace(/500|600/g, '300')}` : 'dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300'}`
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {type === '7days' && '7 Days'}
                                                {type === '30days' && '30 Days'}
                                                {type === 'never' && 'No Expiry'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreateLink}
                                    disabled={loading}
                                    className={`w-full bg-gradient-to-r ${themeColors?.primary || 'from-blue-600 to-purple-600'} text-white font-semibold py-3 rounded-lg shadow-md transition-transform transform hover:scale-[1.02] flex items-center justify-center gap-2`}
                                >
                                    {loading ? 'Generating...' : 'Create Public Link'}
                                </button>
                            </div>
                        </>
                    )}

                    {shareData && !showRevokeConfirm && (
                        <div className="space-y-6">
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                                <FaCheck className="text-green-500 mt-1 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-green-800 dark:text-green-300 text-sm">Link is Active</h4>
                                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">This chat is publicly accessible via the link below.</p>
                                    <ul className="text-xs text-green-700 dark:text-green-400 mt-2 list-disc list-inside space-y-1">
                                        <li>Shared content is read-only.</li>
                                        <li>If you continue chatting, click <b>Update Link</b> to sync new messages.</li>
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chat Title (Public)</label>
                                <input
                                    type="text"
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 ${themeColors ? themeColors.accent.replace('text-', 'focus:ring-').replace(/500|600/g, '500') : 'focus:ring-blue-500'} focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 transition-colors`}
                                    placeholder="Enter a title for the shared chat"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shared Link</label>
                                <div className="flex gap-2">
                                    <div className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-600 dark:text-gray-300 text-sm flex-1 truncate select-all">
                                        {window.location.origin}{shareData.url}
                                    </div>
                                    <button
                                        onClick={copyToClipboard}
                                        className={`px-3 rounded-lg font-medium transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-600'
                                            }`}
                                        title="Copy Link"
                                    >
                                        {copied ? <FaCheck /> : <FaCopy />}
                                    </button>
                                    <button
                                        onClick={handleSocialShare}
                                        className={`px-3 rounded-lg font-medium bg-gradient-to-r ${themeColors?.primary || 'from-blue-600 to-purple-600'} text-white transition-opacity hover:opacity-90`}
                                        title="Share on Social Media"
                                    >
                                        <FaShareAlt />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                    <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase tracking-wide">Views</span>
                                    <span className="font-bold text-gray-800 dark:text-white text-lg">{shareData.views}</span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                    <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase tracking-wide">Expires</span>
                                    <span className="font-bold text-gray-800 dark:text-white">
                                        {shareData.expiresAt
                                            ? new Date(shareData.expiresAt).toLocaleDateString('en-IN')
                                            : 'Never'}
                                    </span>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex gap-3">
                                <button
                                    onClick={handleUpdate}
                                    className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 font-medium py-2 rounded-lg transition-colors"
                                >
                                    Update Link
                                </button>
                                <button
                                    onClick={() => setShowRevokeConfirm(true)}
                                    className="flex-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <FaTrash className="text-sm" /> Revoke Link
                                </button>
                            </div>
                        </div>
                    )}

                    {shareData && showRevokeConfirm && (
                        <div className="space-y-6 text-center animate-fade-in">
                            <div className="bg-red-50 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaTrash className="text-red-500 text-3xl" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">Revoke Shared Link?</h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm px-4">
                                Are you sure you want to delete this shared link? {getRemainingDays() !== null && (
                                    <span className="font-semibold text-red-600 dark:text-red-400">
                                        (Expires in {getRemainingDays()} days).
                                    </span>
                                )} Anyone with the link will no longer be able to access this conversation.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowRevokeConfirm(false)}
                                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white font-medium py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRevokeLink}
                                    disabled={loading}
                                    className="flex-1 bg-red-600 text-white font-medium py-3 rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                                >
                                    {loading ? 'Revoking...' : 'Yes, Revoke Link'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {shareData && (
                <SocialSharePanel
                    isOpen={showSocialPanel}
                    onClose={() => setShowSocialPanel(false)}
                    url={`${window.location.origin}${shareData.url}`}
                    title={shareData.title}
                    description="Check out this chat I had with SetuAI!"
                />
            )}
        </div>
    );
}
