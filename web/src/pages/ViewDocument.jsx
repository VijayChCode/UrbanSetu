import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaDownload, FaArrowLeft, FaFilePdf, FaImage, FaFileAlt, FaLock } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ViewDocument() {
    const { documentId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fileType, setFileType] = useState(null);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const { currentUser } = useSelector((state) => state.user);

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
            'downloads': 'Downloads Portal',
        };
        return mapping[src] || src.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const docType = document?.type?.replace(/_/g, ' ') || 'Document';
    usePageTitle(`${docType.charAt(0).toUpperCase() + docType.slice(1)} - UrbanSetu`);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isPublic = location.pathname.startsWith('/view/');

    useEffect(() => {
        if (documentId === 'preview') {
            // ... (keep existing preview logic)
            // But also skip blob fetch for PDF if mobile?
            // Existing preview logic (lines 46-54) handles blob fetching.
            // Let's leave preview logic as is for now or modify it to respect mobile too?
            // The prompt "check what may be issue" implies main view.
            // Let's modify the Main `fetchDocument` logic below. 
            // ...
            const params = new URLSearchParams(location.search);
            const url = params.get('url');
            const type = params.get('type') || 'document';
            const name = params.get('name') || 'Document Preview';

            if (url) {
                setDocument({
                    url,
                    type,
                    mimeType: type === 'document' || url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                    name
                });

                let derivedType = 'other';
                if (type === 'image') derivedType = 'image';
                else derivedType = 'pdf';

                setFileType(derivedType);

                if (derivedType === 'pdf' && !isMobile) {
                    // Fix: Standard fetch for Cloudinary to avoid CORS 'credentials/wildcard' issues
                    const isCloudinary = url.includes('cloudinary.com');
                    const fetchPromise = isCloudinary
                        ? fetch(url, { mode: 'cors' })
                        : authenticatedFetch(url, { mode: 'cors' });

                    fetchPromise
                        .then(r => r.blob())
                        .then(blob => {
                            const cleanBlob = new Blob([blob], { type: 'application/pdf' });
                            setPdfBlobUrl(URL.createObjectURL(cleanBlob));
                        })
                        .catch(err => console.error("Preview blob fetch failed", err));
                }

                setLoading(false);
            } else {
                setError("No URL provided for preview");
                setLoading(false);
            }
            return;
        }

        const fetchDocument = async () => {
            try {
                const endpoint = isPublic
                    ? `${API_BASE_URL}/api/rental/public/documents/${documentId}`
                    : `${API_BASE_URL}/api/rental/loans/documents/${documentId}`;

                const res = isPublic
                    ? await fetch(endpoint, { credentials: 'omit' })
                    : await authenticatedFetch(endpoint);
                const data = await res.json();

                if (res.ok && data.success) {
                    if (isPublic && !data.document.category && currentUser) {
                        const pathPrefix = currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin' : '/user';
                        navigate(`${pathPrefix}/view/${documentId}${location.search}`, { replace: true });
                        return;
                    }
                    setDocument(data.document);

                    let mimeType = data.document.mimeType;

                    // Logic to determine type
                    let type = 'other';
                    if (mimeType) {
                        if (mimeType.includes('pdf')) type = 'pdf';
                        else if (mimeType.includes('image')) type = 'image';
                    }

                    if (type === 'other') {
                        // Fallback check logic similar to determineFileType
                        const url = data.document.url;
                        if (url.includes('/raw/') || url.includes('.pdf')) {
                            type = 'pdf';
                        }
                    }

                    setFileType(type);

                    // If PDF and NOT mobile, fetch blob immediately to render locally
                    if (type === 'pdf' && !isMobile) {
                        try {
                            // Fix: Standard fetch for Cloudinary to avoid CORS 'credentials/wildcard' issues
                            const isCloudinary = data.document.url.includes('cloudinary.com');
                            const fileRes = isCloudinary
                                ? await fetch(data.document.url, { mode: 'cors' })
                                : await authenticatedFetch(data.document.url, { mode: 'cors' });

                            const blob = await fileRes.blob();
                            const cleanBlob = new Blob([blob], { type: 'application/pdf' });
                            const blobUrl = URL.createObjectURL(cleanBlob);
                            setPdfBlobUrl(blobUrl);
                        } catch (blobErr) {
                            console.error("Failed to load PDF blob", blobErr);
                            // If blob fails, fallback to direct URL (might download, but better than nothing)
                        }
                    }
                } else {
                    setError(data.message || 'Failed to fetch document');
                }
            } catch (err) {
                console.error('Error fetching document:', err);
                setError('Failed to load document');
            } finally {
                setLoading(false);
            }
        };

        if (documentId) {
            fetchDocument();
        }

        return () => {
            if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl);
            }
        };
    }, [documentId, currentUser, navigate]);

    // determineFileType removed as it's integrated above or no longer crucial given backend fixes
    // We keep handleDownloadDocument as is.

    const handleDownloadDocument = async (docUrl, docName) => {
        try {
            if (!docUrl) return;

            // Optimization: Use locally fetched blob if available
            if (pdfBlobUrl) {
                const filename = `${docName || 'document'}-${new Date().getTime()}.pdf`;
                const link = window.document.createElement('a');
                link.href = pdfBlobUrl;
                link.download = filename;
                window.document.body.appendChild(link);
                link.click();
                window.document.body.removeChild(link);
                return;
            }

            // Fetch from backend proxy to handle Auth headers and Filenames correctly
            const downloadUrl = document.category
                ? `${API_BASE_URL}/api/rental/public/documents/${documentId}/download`
                : `${API_BASE_URL}/api/rental/loans/documents/${documentId}/download`;
            // Use _blank to avoid disrupting current page, browser will render it as download if header is set
            window.open(downloadUrl, '_blank');
            return;

            /*
            const disposition = response.headers.get('content-disposition');
            if (disposition && disposition.includes('filename=')) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) {
                    filename = match[1];
                }
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            */

        } catch (error) {
            console.error('Error downloading document:', error);
            alert("Download failed. Please try again or contact support.");
        }
    };

    const getFileExtension = (url) => {
        if (!url) return '';
        try {
            const urlPath = url.split('?')[0];
            // Fix: Check if there is even a dot in the filename part
            const lastSlashIndex = urlPath.lastIndexOf('/');
            const filename = urlPath.substring(lastSlashIndex + 1);

            if (filename.includes('.')) {
                return filename.split('.').pop().toLowerCase();
            }
            return '';
        } catch (e) {
            return '';
        }
    };

    if (loading) {
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

    if (isPublic && !currentUser && !document.category) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 p-4 transition-colors duration-300">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaLock className="text-2xl text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Restricted Access</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">You must be signed with authorized user account to view this document.</p>
                    <button
                        onClick={() => navigate('/sign-in')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Sign In to View
                    </button>
                </div>
            </div>
        );
    }

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
                        <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white capitalize truncate w-full sm:w-auto">
                            {document.type?.replace(/_/g, ' ') || 'Document View'}
                        </h1>
                        {source && (
                            <div className="flex flex-wrap items-center">
                                <span className="inline-flex items-center text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                                    {formatSourceLabel(source)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                {isPublic && !document.category ? (
                    <button
                        onClick={() => navigate('/sign-in')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <span className="hidden sm:inline">Sign in to Download</span>
                        <span className="sm:hidden">Sign in</span>
                    </button>
                ) : (
                    <button
                        onClick={() => handleDownloadDocument(document.url, document.type || document.category)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <FaDownload />
                        <span className="hidden sm:inline">Download</span>
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 md:p-8 flex items-center justify-center overflow-auto bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex items-center justify-center relative border dark:border-gray-800">
                    {isImage ? (
                        <img
                            src={document.url}
                            alt="Document"
                            className="max-w-full max-h-full object-contain"
                        />
                    ) : isPdf ? (
                        isMobile ? (
                            <iframe
                                src={`https://docs.google.com/gview?url=${encodeURIComponent(document.url)}&embedded=true`}
                                className="w-full h-full"
                                title="Document Viewer"
                            />
                        ) : !pdfBlobUrl ? (
                            <div className="flex flex-col items-center justify-center">
                                <UrbanSetuSpinner size="lg" className="mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
                            </div>
                        ) : (
                            <iframe
                                src={pdfBlobUrl || document.url}
                                className="w-full h-full"
                                title="Document Viewer"
                            />
                        )
                    ) : (
                        <iframe
                            src={pdfBlobUrl || document.url}
                            className="w-full h-full"
                            title="Document Viewer"
                        />
                    )}
                </div>
            </div>
        </div >
    );
}
