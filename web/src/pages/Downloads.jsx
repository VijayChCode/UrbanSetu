import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';
import { FaWindows, FaApple, FaAndroid, FaLinux, FaDownload, FaHistory, FaMobileAlt, FaDesktop, FaInfoCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import AdminDeploymentManagementSkeleton from '../components/skeletons/AdminDeploymentManagementSkeleton';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Downloads() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, windows, macos, mobile

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
            if (file.url) {
                // Cloudinary or direct URL
                window.location.href = file.url;
            } else {
                // S3 Presigned URL
                const res = await authenticatedFetch(`${API_BASE_URL}/api/deployment/public-download-url?id=${encodeURIComponent(file.id)}`);
                const data = await res.json();
                if (data.success && data.url) {
                    window.location.href = data.url;
                } else {
                    toast.error('Download link expired or invalid');
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

    // Filter for Version History Table
    const filteredFiles = activeTab === 'all'
        ? files
        : activeTab === 'mobile'
            ? files.filter(f => ['android', 'ios'].includes(f.platform))
            : files.filter(f => f.platform === activeTab);

    if (loading) {
        return <AdminDeploymentManagementSkeleton />;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 pt-16 pb-12 transition-colors duration-300">
            <SEO
                title="Download UrbanSetu App - Real Estate at Your Fingertips | UrbanSetu"
                description="Download the UrbanSetu app for Windows, macOS, Android, and iOS. Get the latest features for property search, investments, and community hub on the go."
                keywords="UrbanSetu app download, real estate app India, property mobile app, real estate desktop software"
            />
            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
                    Download <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">UrbanSetu</span>
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Experience the next-generation real estate ecosystem on your preferred device.
                </p>
            </div>

            {/* Latest Release Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                    {/* macOS Card */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center group">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FaApple className="text-4xl text-gray-800 dark:text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">macOS</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">macOS 10.15+</p>

                        {latestDeployments.macos ? (
                            <div className="w-full mt-auto">
                                <button
                                    onClick={() => handleDownload(latestDeployments.macos)}
                                    className="w-full py-3 px-4 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mb-3"
                                >
                                    <FaDownload /> Download
                                </button>
                                <div className="text-xs text-gray-500 font-mono mb-3">
                                    v{latestDeployments.macos.version} • {formatFileSize(latestDeployments.macos.size)}
                                </div>
                                {latestDeployments.macos.description && (
                                    <div className="text-left bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 mb-3">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Latest Improvements</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{latestDeployments.macos.description}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full mt-auto py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl font-semibold cursor-not-allowed">
                                Coming Soon
                            </div>
                        )}
                    </div>

                    {/* Windows Card */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center group">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FaWindows className="text-4xl text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Windows</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Windows 10/11 (64-bit)</p>

                        {latestDeployments.windows ? (
                            <div className="w-full mt-auto">
                                <button
                                    onClick={() => handleDownload(latestDeployments.windows)}
                                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mb-3"
                                >
                                    <FaDownload /> Download
                                </button>
                                <div className="text-xs text-gray-500 font-mono mb-3">
                                    v{latestDeployments.windows.version} • {formatFileSize(latestDeployments.windows.size)}
                                </div>
                                {latestDeployments.windows.description && (
                                    <div className="text-left bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 mb-3">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Latest Improvements</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{latestDeployments.windows.description}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full mt-auto py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl font-semibold cursor-not-allowed">
                                Coming Soon
                            </div>
                        )}
                    </div>

                    {/* Linux Card (Placeholder/Empty as per current backend) */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center group opacity-75">
                        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FaLinux className="text-4xl text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Linux</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Debian / RPM</p>

                        <div className="w-full mt-auto py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl font-semibold cursor-not-allowed text-sm">
                            Coming Soon
                        </div>
                    </div>

                    {/* Mobile Card */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center group">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FaAndroid className="text-4xl text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Mobile</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Android & iOS</p>

                        {latestDeployments.android ? (
                            <div className="w-full mt-auto">
                                <button
                                    onClick={() => handleDownload(latestDeployments.android)}
                                    className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mb-3"
                                >
                                    <FaDownload /> APK
                                </button>
                                <div className="text-xs text-gray-500 font-mono mb-3">
                                    v{latestDeployments.android.version} (Android)
                                </div>
                                {latestDeployments.android.description && (
                                    <div className="text-left bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 mb-3">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Latest Improvements</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{latestDeployments.android.description}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full mt-auto py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl font-semibold cursor-not-allowed">
                                Coming Soon
                            </div>
                        )}
                        {/* iOS Link if available */}
                        {latestDeployments.ios && (
                            <button
                                onClick={() => handleDownload(latestDeployments.ios)}
                                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Download for iOS
                            </button>
                        )}
                    </div>

                </div>
            </div>

            {/* Version History Table */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <FaHistory className="text-blue-500" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">All Versions</h2>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                            {['all', 'windows', 'macos', 'mobile'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                        } capitalize`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Platform</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Version & Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">What's New</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredFiles.map((file) => (
                                    <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                {file.platform === 'windows' && <FaWindows className="text-blue-500" />}
                                                {file.platform === 'macos' && <FaApple className="text-gray-800 dark:text-white" />}
                                                {file.platform === 'android' && <FaAndroid className="text-green-500" />}
                                                {file.platform === 'ios' && <FaApple className="text-gray-800 dark:text-white" />}
                                                <span className="font-medium text-gray-900 dark:text-white capitalize">{file.platform}</span>
                                                {file.isActive && (
                                                    <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full font-bold">Latest</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-sm text-gray-900 dark:text-white">v{file.version}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(file.createdAt)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-xs md:max-w-md lg:max-w-lg">
                                                {file.description ? (
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic">
                                                        "{file.description}"
                                                    </p>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">No changelog provided</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                            {formatFileSize(file.size)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => handleDownload(file)}
                                                className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium inline-flex items-center gap-2"
                                            >
                                                <FaDownload /> Download
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredFiles.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            No versions found for this platform.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
