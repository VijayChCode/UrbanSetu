import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaDownload, FaArrowLeft, FaFilePdf, FaImage, FaFileAlt, FaLock } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ViewChatDocument() {
    const { documentId } = useParams(); // May not be used if we rely purely on query params for separate viewer
    const navigate = useNavigate();
    const location = useLocation();
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fileType, setFileType] = useState(null);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [isRestricted, setIsRestricted] = useState(true);
    const [verifying, setVerifying] = useState(true);
    const { currentUser } = useSelector((state) => state.user);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const params = new URLSearchParams(location.search);
    const source = params.get('source');

    const formatSourceLabel = (src) => {
        if (!src) return '';
        const mapping = {
            'my_appointments': 'My Appointments',
            'admin_appointments': 'Admin Appointments',
            'gemini_chatbox': 'SetuAI Chatbox',
            'disputes': 'Dispute Evidence',
            'loans': 'Loan Documents',
            'verification': 'User Verification',
            'deployment': 'Deployment Management',
        };
        return mapping[src] || src.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const pageTitle = isRestricted
        ? 'Restricted Document'
        : (document?.name || (document?.type ? `${document.type.charAt(0).toUpperCase() + document.type.slice(1)} Preview` : 'Document Preview'));
    usePageTitle(`${pageTitle} - UrbanSetu`);

    const isPublic = location.pathname.startsWith('/view/');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const url = params.get('url');
        const typeRaw = params.get('type') || 'document';
        const type = typeRaw.toLowerCase();
        let name = params.get('name') || 'Document Preview';

        // Normalize extension to lowercase for display consistency
        if (name && name.includes('.')) {
            const lastDotIndex = name.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                name = name.substring(0, lastDotIndex) + name.substring(lastDotIndex).toLowerCase();
            }
        }

        if (url) {
            setDocument({
                url,
                type,
                mimeType: type === 'document' || url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                name
            });

            let derivedType = 'other';
            // Fix: Handle URLs with query params (e.g., signed URLs)
            const cleanUrl = url.split('?')[0];
            let ext = cleanUrl.split('.').pop().toLowerCase();

            // If extension from URL seems invalid (too long, likely an ID), try getting it from name
            if (!ext || ext.length > 5) {
                if (name && name.includes('.')) {
                    ext = name.split('.').pop().toLowerCase();
                }
            }

            if (type === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) derivedType = 'image';
            else if (type === 'pdf' || ext === 'pdf') derivedType = 'pdf';
            else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) {
                derivedType = 'office';
            } else if (['txt', 'json', 'xml', 'md'].includes(ext)) {
                derivedType = 'text';
            } else {
                // For all other types, try Google Viewer
                derivedType = 'google-viewer';
            }

            setFileType(derivedType);

            // Fetch blob for PDF or Text to view safely
            if (derivedType === 'pdf' || derivedType === 'text') {
                setLoading(true);
                // Fix: Standard fetch for Cloudinary to avoid CORS 'credentials/wildcard' issues
                const isCloudinary = url.includes('cloudinary.com');
                const fetchPromise = isCloudinary
                    ? fetch(url, { mode: 'cors' })
                    : authenticatedFetch(url, { mode: 'cors' });

                fetchPromise
                    .then(r => r.blob())
                    .then(blob => {
                        // Force correct MIME type for PDF, otherwise trust blob for text
                        const blobType = derivedType === 'pdf' ? 'application/pdf' : (blob.type || 'text/plain');
                        const cleanBlob = new Blob([blob], { type: blobType });
                        setPdfBlobUrl(URL.createObjectURL(cleanBlob));
                        setLoading(false);
                    })
                    .catch(err => {
                        console.error("Preview blob fetch failed", err);
                        // Don't set error, just stop loading so we can fallback to iframe with URL
                        setLoading(false);
                    });
            } else {
                setLoading(false);
            }
        } else {
            setError("No URL provided for preview");
            setLoading(false);
        }

        return () => {
            if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl);
            }
        };
    }, [location.search]);

    const handleDownloadDocument = async (docUrl, docName) => {
        try {
            if (!docUrl) return;

            // Ensure filename has extension
            let filename = docName || `document-${Date.now()}`;

            // If filename doesn't have an extension, try to determine it
            if (!filename.includes('.')) {
                // Try from URL first
                const cleanUrl = docUrl.split('?')[0];
                let ext = cleanUrl.split('.').pop().toLowerCase();

                // If URL ext is invalid, fallback based on fileType
                if (!ext || ext.length > 5) {
                    if (fileType === 'pdf') ext = 'pdf';
                    else if (fileType === 'image') ext = 'jpg'; // Default for image
                    else if (fileType === 'text') ext = 'txt';
                }

                if (ext) {
                    filename = `${filename}.${ext}`;
                }
            }

            // Optimization: Use locally fetched blob if available
            if (pdfBlobUrl) {
                const link = window.document.createElement('a');
                link.href = pdfBlobUrl;
                link.download = filename;
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
                return;
            }

            // For other files, direct open/download
            // Use fetch to trigger download to avoid browser opening it in tab if possible
            try {
                // Fix: Standard fetch for Cloudinary to avoid CORS 'credentials/wildcard' issues
                const isCloudinary = docUrl.includes('cloudinary.com');
                const response = isCloudinary
                    ? await fetch(docUrl, { mode: 'cors' })
                    : await authenticatedFetch(docUrl, { mode: 'cors' });

                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = window.document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
            } catch (err) {
                // Fallback to window.open if fetch fails (CORS etc)
                console.log("Fetch download failed, falling back to window.open", err);
                window.open(docUrl, '_blank');
            }

        } catch (error) {
            console.error('Error downloading document:', error);
            alert("Download failed. Please try again or contact support.");
        }
    };

    // Access Control with Backend Verification
    useEffect(() => {
        const verifyAccess = async () => {
            if (!currentUser) {
                setIsRestricted(true);
                setVerifying(false);
                return;
            }

            const params = new URLSearchParams(location.search);
            const appointmentId = params.get('appointmentId');
            const url = params.get('url');

            // Admin Bypass: Allow admins to view without appointmentId verification if needed
            const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin');
            if (isAdmin && url && !appointmentId) {
                setIsRestricted(false);
                setVerifying(false);
                return;
            }

            // If no appointmentId, we cannot verify securely -> Restrict
            if (!appointmentId || !url) {
                console.warn("Missing appointmentId or url for secure verification");
                setIsRestricted(true);
                setVerifying(false);
                return;
            }

            try {
                // Verify against backend
                // Extract clean URL for backend if needed, but passing full URL is safer for logging/matching
                const response = await authenticatedFetch(`${API_BASE_URL}/api/bookings/verify-document-access`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        appointmentId,
                        documentUrl: url
                    })
                });

                const data = await response.json();

                if (response.ok && data.allowed) {
                    setIsRestricted(false);
                } else {
                    console.warn("Access denied by backend:", data.message);
                    setIsRestricted(true);
                }
            } catch (err) {
                console.error("Access verification failed:", err);
                setIsRestricted(true);
            } finally {
                setVerifying(false);
            }
        };

        verifyAccess();
    }, [currentUser, location.search]);

    // We do NOT return early anymore, we render the layout with restricted content.

    if (loading || verifying) {
        return (
            <div className="min-h-screen flex flex-col gap-4 items-center justify-center bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
                <UrbanSetuSpinner size="lg" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">Loading document...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 p-4 transition-colors duration-300">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaFileAlt className="text-2xl text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error Loading Document</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!document) return null;

    const isImage = fileType === 'image';
    const isPdf = fileType === 'pdf';

    return (
        <div className="min-h-screen bg-transparent dark:bg-gray-950 flex flex-col transition-colors duration-300">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-md dark:shadow-gray-900/50 px-4 sm:px-6 py-4 flex items-center justify-between z-10 gap-2 border-b dark:border-gray-700">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400 transition-colors shrink-0"
                    >
                        <FaArrowLeft />
                    </button>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1 min-w-0 pr-2">
                        <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white truncate w-full sm:w-auto">
                            {isRestricted ? 'Restricted Document' : (document.name || 'Document View')}
                        </h1>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span
                                title="This document is from an end-to-end encrypted chat and is accessible only by you and the other participant. Anyone else attempting to view this link will be denied access."
                                className="inline-flex items-center text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 shadow-sm cursor-help"
                            >
                                <FaLock className="w-2 h-2 mr-1 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Encrypted & Secure</span>
                            </span>
                            {source && (
                                <span className="inline-flex items-center text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                                    {formatSourceLabel(source)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {isRestricted ? (
                    currentUser ? (
                        <button
                            disabled
                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed border dark:border-gray-700 shrink-0"
                        >
                            <FaLock className="text-xs" />
                            <span className="hidden sm:inline">Download Restricted</span>
                            <span className="sm:hidden">Restricted</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/sign-in')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                        >
                            <span className="hidden sm:inline">Sign in to Download</span>
                            <span className="sm:hidden">Sign in</span>
                        </button>
                    )
                ) : (
                    <button
                        onClick={() => handleDownloadDocument(document.url, document.name)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                    >
                        <FaDownload />
                        <span className="hidden sm:inline">Download</span>
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 md:p-8 flex items-center justify-center overflow-auto bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex items-center justify-center relative border dark:border-gray-800">
                    {isRestricted ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-gray-800/50 w-full h-full">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                                <FaLock className="text-2xl text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Restricted Access</h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                                {!currentUser
                                    ? "This document is private. Please sign in to view and download."
                                    : "You are not authorized to view or download this document."}
                            </p>
                            <button
                                onClick={() => navigate(currentUser ? -1 : '/sign-in')}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {currentUser ? "Go Back" : "Sign In"}
                            </button>
                        </div>
                    ) : isImage ? (
                        <img
                            src={document.url}
                            alt="Document"
                            className="max-w-full max-h-full object-contain"
                        />
                    ) : ((isPdf && !isMobile) || fileType === 'text') ? (
                        !pdfBlobUrl && loading ? (
                            <div className="flex flex-col items-center justify-center">
                                <UrbanSetuSpinner size="lg" className="mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">Loading Document...</p>
                            </div>
                        ) : (
                            <iframe
                                src={pdfBlobUrl || document.url}
                                className="w-full h-full"
                                title="Document Viewer"
                            />
                        )
                    ) : (fileType === 'office' || fileType === 'google-viewer' || (isPdf && isMobile)) ? (
                        <iframe
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(document.url)}&embedded=true`}
                            className="w-full h-full"
                            title="Document Viewer"
                        />
                    ) : (
                        /* Unsupported types - Show placeholder */
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-gray-800/50 w-full h-full">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                <FaFileAlt className="text-4xl text-gray-400 dark:text-gray-500" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Preview Not Available</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                This file type cannot be previewed in the browser. Please download the file to view it.
                            </p>
                            <button
                                onClick={() => handleDownloadDocument(document.url, document.name)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                <FaDownload /> Download File
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}