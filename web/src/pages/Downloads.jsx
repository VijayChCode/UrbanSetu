import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';
import { FaWindows, FaApple, FaAndroid, FaLinux, FaDownload, FaHistory, FaMobileAlt, FaDesktop, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import DownloadsSkeleton from '../components/skeletons/DownloadsSkeleton';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import Typewriter from '../components/ui/Typewriter';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Downloads() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, windows, macos, mobile
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);

    useEffect(() => {
        fetchDeploymentFiles();
    }, []);

    const fetchDeploymentFiles = async () => {
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/deployment/public`);
            const data = await response.json();
            if (data.success) {
                setFiles(data.data);
            }
        } catch (error) {
            console.error('Error fetching downloads:', error);
            toast.error('Failed to load available downloads');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (file) => {
        try {
            // Redirect active/latest files to Google Drive to establish trust
            if (file.isActive) {
                window.open('https://drive.google.com/drive/folders/1Hl8P93mnWPSCmoetuQn48jvWkwZGYFla?usp=sharing', '_blank');
                toast.success('Redirecting to Google Drive to download the secure package');
                return;
            }

            // Check if the URL is a Cloudinary URL (publicly accessible)
            const isCloudinary = file.url && (file.url.includes('cloudinary.com') || file.url.includes('res.cloudinary.com'));

            if (isCloudinary) {
                // Cloudinary files are public, can be downloaded directly
                window.location.href = file.url;
            } else {
                // S3 files are private, MUST use a presigned URL
                // Even if file.url exists (it's the direct link), we need to call the API to get a signed one
                const res = await authenticatedFetch(`${API_BASE_URL}/api/deployment/public-download-url?id=${encodeURIComponent(file.id)}`);
                const data = await res.json();
                if (data.success && data.url) {
                    window.location.href = data.url;
                } else {
                    toast.error(data.message || 'Download link expired or invalid');
                }
            }
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to start download');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Filter Active (Latest) Deployments
    const latestDeployments = {
        windows: files.find(f => f.isActive && f.platform === 'windows'),
        macos: files.find(f => f.isActive && f.platform === 'macos'),
        android: files.find(f => f.isActive && f.platform === 'android'),
        ios: files.find(f => f.isActive && f.platform === 'ios'),
    };

    // Explicitly sort files by creation date descending (latest first)
    const sortedFiles = [...files].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Filter for Version History Table
    const filteredFiles = activeTab === 'all'
        ? sortedFiles
        : activeTab === 'mobile'
            ? sortedFiles.filter(f => ['android', 'ios'].includes(f.platform))
            : sortedFiles.filter(f => f.platform === activeTab);

    if (loading) {
        return <DownloadsSkeleton />;
    }

    const renderPlatformIcon = (platform) => {
        switch (platform) {
            case 'windows': return <FaWindows className="text-blue-500" />;
            case 'macos': return <FaApple className="text-gray-800 dark:text-white" />;
            case 'android': return <FaAndroid className="text-green-500" />;
            case 'ios': return <FaApple className="text-gray-800 dark:text-white" />;
            default: return <FaDesktop className="text-gray-400" />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16 transition-colors duration-300">
            <SEO
                title="Download UrbanSetu App - Real Estate at Your Fingertips | UrbanSetu"
                description="Download the UrbanSetu app for Windows, macOS, Android, and iOS. Get the latest features for property search, investments, and community hub on the go."
                keywords="UrbanSetu app download, real estate app India, property mobile app, real estate desktop software"
            />

            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/50 dark:from-blue-900/10 to-transparent pointer-events-none z-0"></div>

            <div className="relative z-10">
                {/* Hero Section */}
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold mb-6 border border-blue-200 dark:border-blue-800">
                        <FaMobileAlt className="animate-bounce" /> MULTI-PLATFORM ECOSYSTEM
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-6 min-h-[3.6em] md:min-h-[1.2em] flex items-center justify-center">
                        <Typewriter
                            words={[
                                "Get UrbanSetu Everywhere",
                                "Download App Anywhere",
                                "Experience Seamless Access",
                                "Explore Smart Real Estate in Smart Devices"
                            ]}
                            splitFirstWord={true}
                            gradientClassName="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400"
                        />
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                        Secure, fast, and feature-rich. Download our native applications for the best experience on any device.
                    </p>
                </div>

                {/* Latest Release Cards */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { id: 'macos', name: 'macOS', icon: FaApple, color: 'gray', subtitle: 'macOS 10.15+' },
                            { id: 'windows', name: 'Windows', icon: FaWindows, color: 'blue', subtitle: 'Windows 10/11' },
                            { id: 'linux', name: 'Linux', icon: FaLinux, color: 'yellow', subtitle: 'Debian / RPM' },
                            { id: 'android', name: 'Mobile', icon: FaAndroid, color: 'green', subtitle: 'Android APK' }
                        ].map((platform) => {
                            const latest = latestDeployments[platform.id === 'android' ? 'android' : platform.id];
                            const isComingSoon = !latest && platform.id !== 'android';
                            const isAndroid = platform.id === 'android';

                            return (
                                <div key={platform.id} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none hover:translate-y-[-8px] transition-all duration-500 group relative overflow-hidden">
                                    {/* Platform Icon Bg */}
                                    <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${platform.color}-50 dark:bg-${platform.color}-900/10 rounded-full group-hover:scale-125 transition-transform duration-700`}></div>

                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className={`w-16 h-16 bg-${platform.color}-50 dark:bg-${platform.color}-900/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner`}>
                                            <platform.icon className={`text-3xl text-${platform.color}-600 dark:text-${platform.color}-400`} />
                                        </div>

                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{platform.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">{platform.subtitle}</p>

                                        {latest ? (
                                            <div className="mt-auto space-y-4">
                                                {latest.isActive && (
                                                    <div className="flex justify-center mb-1">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-850 shadow-sm">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 animate-pulse"></span>
                                                            Verified Google Drive Mirror
                                                        </span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => handleDownload(latest)}
                                                    className={`w-full py-4 bg-${platform.color === 'gray' ? 'gray-900' : platform.color + '-600'} hover:opacity-90 text-white rounded-2xl font-bold text-lg shadow-lg shadow-${platform.color}-500/20 transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <FaDownload className="text-sm" /> Download
                                                </button>

                                                <div className="text-center">
                                                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                                                        VERSION {latest.version} • {formatFileSize(latest.size)}
                                                    </span>
                                                </div>

                                                {latest.description && (
                                                    <div
                                                        onClick={() => {
                                                            setModalData({ ...latest, platformName: platform.name });
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100/50 dark:border-gray-800 transition-all duration-300 group/whatsnew relative cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`w-1 h-3 bg-${platform.color}-500 rounded-full`}></div>
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">What's New</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed italic">
                                                            "{latest.description}"
                                                        </p>

                                                        <div className="absolute bottom-2 right-4 animate-pulse">
                                                            <span className="text-[7px] font-black text-blue-500 uppercase tracking-[0.2em]">CLICK TO EXPAND</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-auto py-4 px-4 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 rounded-2xl font-bold text-center border border-dashed border-gray-200 dark:border-gray-700">
                                                Coming Soon
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Version History Section */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                                <FaHistory className="text-blue-600 dark:text-blue-400 text-xl" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Version History</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Tracking every step of our evolution.</p>
                            </div>
                        </div>

                        {/* Responsive Tabs */}
                        <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto no-scrollbar">
                            {['all', 'windows', 'macos', 'mobile'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Version List (Visible only on mobile) */}
                    <div className="grid grid-cols-1 gap-4 lg:hidden">
                        {filteredFiles.map((file, index) => (
                            <div 
                                key={file.id} 
                                className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
                                style={{ animation: `vHistoryFadeIn 0.4s ease-out ${index * 0.05}s backwards` }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                            {renderPlatformIcon(file.platform)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white capitalize">{file.platform}</h4>
                                                {file.isActive && (
                                                    <>
                                                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black rounded-full uppercase tracking-widest">LATEST</span>
                                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-100 dark:border-indigo-850">GOOGLE DRIVE</span>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 font-mono tracking-tighter">v{file.version} • {formatDate(file.createdAt)}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(file)}
                                        className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl"
                                    >
                                        <FaDownload />
                                    </button>
                                </div>

                                {/* Mobile Changelog Section */}
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">CHANGELOG</span>
                                        <span className="text-[10px] font-mono text-gray-400">{formatFileSize(file.size)}</span>
                                    </div>
                                    {file.description ? (
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic line-clamp-2">
                                                "{file.description}"
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setModalData({ ...file, platformName: file.platform });
                                                    setIsModalOpen(true);
                                                }}
                                                className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"
                                            >
                                                View Details <FaInfoCircle className="text-[10px]" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">No changelog data</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Version Table (Hidden on mobile) */}
                    <div className="hidden lg:block bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800/50">
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Platform</th>
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Meta Data</th>
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">What's New</th>
                                    <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {filteredFiles.map((file, index) => (
                                    <tr 
                                        key={file.id} 
                                        className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors group"
                                        style={{ animation: `vHistoryFadeIn 0.3s ease-out ${index * 0.03}s backwards` }}
                                    >
                                        <td className="px-8 py-8 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl group-hover:bg-white dark:group-hover:bg-gray-700 shadow-sm transition-colors">
                                                    {renderPlatformIcon(file.platform)}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900 dark:text-white capitalize block">{file.platform}</span>
                                                    {file.isActive && (
                                                        <div className="flex gap-1.5 mt-1">
                                                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black rounded-full uppercase tracking-widest">LATEST</span>
                                                            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-100 dark:border-indigo-850">GOOGLE DRIVE</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-8 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-black text-xs text-gray-900 dark:text-white font-mono">v{file.version}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">{formatDate(file.createdAt)}</span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 font-mono">{formatFileSize(file.size)}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-8">
                                            <div className="max-w-md xl:max-w-2xl">
                                                {file.description ? (
                                                    <div>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic line-clamp-2">
                                                            "{file.description}"
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                setModalData({ ...file, platformName: file.platform });
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                        >
                                                            Read Full Details <FaInfoCircle className="text-[10px]" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Core system updates and stabilizers.</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-8 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => handleDownload(file)}
                                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 ml-auto"
                                            >
                                                <FaDownload /> DOWNLOAD
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredFiles.length === 0 && (
                        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-800 p-20 text-center">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-6 text-gray-400">
                                <FaInfoCircle className="text-4xl" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Versions Available</h3>
                            <p className="text-gray-500 dark:text-gray-400">The selected platform doesn't have any archived versions yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Release Notes Modal */}
            {isModalOpen && modalData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-modal-fade">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/85 backdrop-blur-md"
                        onClick={() => setIsModalOpen(false)}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[85vh] rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col animate-modal-slide">
                        {/* Header */}
                        <div className="px-6 py-5 sm:p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center">
                                    <FaInfoCircle className="text-blue-600 dark:text-blue-400 text-lg sm:text-xl" />
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Release Notes</h3>
                                    <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                        {modalData.platformName} • Version {modalData.version}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group"
                            >
                                <FaTimes className="text-sm sm:text-base group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 sm:p-8 custom-scrollbar">
                            <div className="prose dark:prose-invert max-w-none">
                                <div className="flex items-center gap-2 mb-4 sm:mb-6 text-blue-600 dark:text-blue-400 font-black text-[9px] sm:text-[10px] uppercase tracking-[0.3em]">
                                    <div className="w-6 sm:w-8 h-[2px] bg-blue-600 dark:bg-blue-400"></div>
                                    Full Changelog
                                </div>
                                <span className="text-[15px] sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed sm:leading-loose italic whitespace-pre-wrap block">
                                    "{modalData.description}"
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 sm:p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                                <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-full">
                                    <span className="text-[9px] sm:text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest leading-none">Verified Build</span>
                                </div>
                                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Built: {new Date(modalData.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    handleDownload(modalData);
                                    setIsModalOpen(false);
                                }}
                                className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
                            >
                                <FaDownload className="text-xs sm:text-sm" /> Download v{modalData.version}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes vHistoryFadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
