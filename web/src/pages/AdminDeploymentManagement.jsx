import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Link } from 'react-router-dom';
import { FaUpload, FaTrash, FaDownload, FaCheck, FaTimes, FaMobile, FaDesktop, FaApple, FaAndroid, FaWindows, FaSpinner, FaCloudUploadAlt, FaHistory, FaInfoCircle, FaRocket, FaFileCode } from 'react-icons/fa';
import { toast } from 'react-toastify';

import { usePageTitle } from '../hooks/usePageTitle';
import { resetAndroidDownloadCache } from '../utils/androidDownload';
import AdminDeploymentManagementSkeleton from '../components/skeletons/AdminDeploymentManagementSkeleton';
import { authenticatedFetch } from '../utils/auth';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminDeploymentManagement() {
  // Set page title
  usePageTitle("Deployment Management - App Updates");

  const { currentUser } = useSelector((state) => state.user);

  const [files, setFiles] = useState([]);
  const [activeFiles, setActiveFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadXhr, setUploadXhr] = useState(null);
  const [uploadData, setUploadData] = useState({
    platform: 'android',
    version: '',
    description: '',
    isActive: false
  });

  useEffect(() => {
    fetchFiles();
    fetchActiveFiles();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uploadXhr) {
        uploadXhr.abort();
      }
    };
  }, [uploadXhr]);

  const fetchFiles = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/deployment`);
      const data = await response.json();
      if (data.success) {
        setFiles(data.data);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to fetch deployment files');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveFiles = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/deployment/active`);
      const data = await response.json();
      if (data.success) {
        setActiveFiles(data.data);
      }
    } catch (error) {
      console.error('Error fetching active files:', error);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.version) {
      toast.error('Please enter a version number');
      return;
    }

    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('platform', uploadData.platform);
      formData.append('version', uploadData.version);
      formData.append('description', uploadData.description);
      formData.append('isActive', uploadData.isActive);

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      setUploadXhr(xhr);

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Handle response
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success) {
              toast.success('File uploaded successfully to AWS S3!');
              setUploadData({
                platform: 'android',
                version: '',
                description: '',
                isActive: false
              });
              document.getElementById('fileInput').value = '';
              fetchFiles();
              fetchActiveFiles();
            } else {
              toast.error(data.message || 'Upload failed');
            }
          } catch (parseError) {
            console.error('Error parsing response:', parseError);
            toast.error('Upload failed - invalid response');
          }
        } else {
          toast.error(`Upload failed with status: ${xhr.status}`);
        }
        setUploading(false);
        setUploadProgress(0);
        setUploadXhr(null);
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        console.error('Upload error:', xhr.statusText);
        toast.error('Upload failed - network error');
        setUploading(false);
        setUploadProgress(0);
        setUploadXhr(null);
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        console.log('Upload aborted');
        toast.error('Upload cancelled');
        setUploading(false);
        setUploadProgress(0);
        setUploadXhr(null);
      });

      // Start upload
      xhr.open('POST', `${API_BASE_URL}/api/deployment/upload`);
      xhr.withCredentials = true; // Include credentials for cookies
      xhr.send(formData);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
      setUploading(false);
      setUploadProgress(0);
      setUploadXhr(null);
    }
  };

  const handleCancelUpload = () => {
    if (uploadXhr) {
      uploadXhr.abort();
    }
  };

  const handleSetActive = async (fileId) => {
    try {
      const encodedId = encodeURIComponent(fileId);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/deployment/set-active/${encodedId}`, {
        method: 'PUT'
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Active deployment updated!');
        fetchFiles();
        fetchActiveFiles();
      } else {
        toast.error(data.message || 'Failed to set active deployment');
      }
      // Invalidate public download cache immediately after changes
      resetAndroidDownloadCache();
    } catch (error) {
      console.error('Error setting active:', error);
      toast.error('Failed to set active deployment');
    }
  };

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const confirmDeleteFile = (fileId) => {
    setFileToDelete(fileId);
    setShowDeleteModal(true);
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      const encodedId = encodeURIComponent(fileToDelete);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/deployment/${encodedId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        toast.success('File deleted successfully!');
        fetchFiles();
        fetchActiveFiles();
      } else {
        toast.error(data.message || 'Failed to delete file');
      }
      resetAndroidDownloadCache();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    } finally {
      setShowDeleteModal(false);
      setFileToDelete(null);
    }
  };

  const handleDownloadFile = async (fileId) => {
    try {
      const encodedId = encodeURIComponent(fileId);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/deployment/download-url?id=${encodedId}`);
      const data = await res.json();
      if (data && data.success && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.message || 'Failed to get download link');
      }
    } catch (err) {
      toast.error('Failed to get download link');
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'android': return <FaAndroid className="text-green-500 text-xl" />;
      case 'ios': return <FaApple className="text-gray-800 text-xl" />;
      case 'windows': return <FaWindows className="text-blue-500 text-xl" />;
      case 'macos': return <FaApple className="text-gray-800 text-xl" />;
      default: return <FaMobile className="text-gray-500 text-xl" />;
    }
  };

  const getPlatformName = (platform) => {
    switch (platform) {
      case 'android': return 'Android';
      case 'ios': return 'iOS';
      case 'windows': return 'Windows';
      case 'macos': return 'macOS';
      default: return 'Mobile';
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Client-side guard: only rootadmin can access
  if (currentUser && currentUser.role !== 'rootadmin') {
    return <Navigate to="/admin" replace />;
  }

  if (loading) {
    return <AdminDeploymentManagementSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      {/* Background Animations */}
      <style>
        {`
            @keyframes blob {
                0% { transform: translate(0px, 0px) scale(1); }
                33% { transform: translate(30px, -50px) scale(1.1); }
                66% { transform: translate(-20px, 20px) scale(0.9); }
                100% { transform: translate(0px, 0px) scale(1); }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-blob { animation: blob 7s infinite; }
            .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
            .animate-fade-in-delay { animation: fadeIn 0.8s ease-out 0.2s forwards; opacity: 0; }
            .animate-fade-in-delay-2 { animation: fadeIn 0.8s ease-out 0.4s forwards; opacity: 0; }
        `}
      </style>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all scale-100">
            <div className="flex items-center gap-4 mb-4 text-red-600 dark:text-red-400">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <FaTrash className="text-xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirm Deletion</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this deployment file? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 font-medium shadow-lg shadow-red-200 transition-colors"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: "4s" }}></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 animate-fade-in relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 flex items-center gap-3">
                <FaCloudUploadAlt className="text-blue-500 dark:text-blue-400" />
                Deployment Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                Manage mobile app deployments, versions, and over-the-air updates via AWS S3.
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/download" target="_blank" className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800 shadow-sm hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                <FaDownload className="mr-2" /> View Downloads Page
              </Link>
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 shadow-sm">
                <FaInfoCircle className="mr-2" /> Max File Size: 200MB
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Upload Form */}
          <div className="lg:col-span-1 animate-fade-in-delay">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sticky top-8 transition-colors">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <FaUpload />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Upload New Build</h2>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platform</label>
                  <div className="relative">
                    <select
                      value={uploadData.platform}
                      onChange={(e) => setUploadData({ ...uploadData, platform: e.target.value })}
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none font-medium text-gray-700 dark:text-white"
                    >
                      <option value="android">Android (APK)</option>
                      <option value="ios">iOS (IPA)</option>
                      <option value="windows">Windows (EXE/MSI)</option>
                      <option value="macos">macOS (DMG/PKG)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Version</label>
                  <input
                    type="text"
                    value={uploadData.version}
                    onChange={(e) => setUploadData({ ...uploadData, version: e.target.value })}
                    placeholder="e.g., 1.0.0"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-medium text-gray-900 dark:text-white dark:placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description / Changelog</label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    placeholder="Describe what's new in this version..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none text-gray-900 dark:text-white dark:placeholder-gray-400"
                  />
                </div>

                <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/80 transition-colors">
                  <input
                    id="isActiveCheckbox"
                    type="checkbox"
                    checked={uploadData.isActive}
                    onChange={(e) => setUploadData({ ...uploadData, isActive: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor="isActiveCheckbox" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer flex-1">
                    Set as Active Deployment
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Build File</label>
                  <div className="relative group">
                    <input
                      id="fileInput"
                      type="file"
                      accept=".apk,.ipa,.exe,.msi,.dmg,.pkg"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 transition-all cursor-pointer text-gray-700 dark:text-gray-300"
                      required
                    />
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {uploading && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Uploading...</span>
                      <span className="text-xs font-bold text-blue-800">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out relative"
                        style={{ width: `${uploadProgress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite] w-full h-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', transform: 'skewX(-20deg)' }}></div>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 mt-2 text-center font-medium">
                      {uploadProgress < 100 ? 'Please wait while we upload your file' : 'Processing on server...'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {uploading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaRocket />
                        Deploy Build
                      </>
                    )}
                  </button>

                  {uploading && (
                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      className="px-4 py-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center justify-center font-medium transition-colors"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Active & History */}
          <div className="lg:col-span-2 space-y-8 animate-fade-in-delay-2">

            {/* Active Deployments Cards */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 transition-colors">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                  <FaCheck />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Currently Active Deployments</h2>
              </div>

              {activeFiles.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-xl border border-dashed border-gray-200 dark:border-gray-600">
                  <FaCloudUploadAlt className="mx-auto text-4xl text-gray-300 dark:text-gray-500 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No active deployments found.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Upload a file and check "Set as Active" to see it here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeFiles.map((file) => (
                    <div key={file.id} className="relative group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-800 rounded-2xl p-5 hover:shadow-md transition-all duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                            {getPlatformIcon(file.platform)}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">{getPlatformName(file.platform)}</h3>
                            <span className="text-xs bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Production</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(file.id)}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow transition-all"
                          title="Download"
                        >
                          <FaDownload />
                        </button>
                      </div>

                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Version:</span>
                          <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{file.version}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Size:</span>
                          <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{formatFileSize(file.size)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Released:</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{formatDate(file.createdAt)}</span>
                        </div>
                      </div>

                      {file.description && (
                        <div className="bg-white/60 dark:bg-black/40 p-3 rounded-xl text-sm text-gray-700 dark:text-gray-300 border border-green-100 dark:border-green-800/30">
                          <div className="flex items-center gap-2 mb-1 font-bold text-xs uppercase text-green-700 dark:text-green-500">
                            <FaFileCode /> What's New
                          </div>
                          {file.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* All Deployments List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaHistory className="text-blue-500 dark:text-blue-400" />
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">Deployment History</h2>
                </div>
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full">
                  {files.length} Total
                </span>
              </div>

              {files.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  No deployments history available.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Platform & Version</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {files.map((file) => (
                        <tr key={file.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                {getPlatformIcon(file.platform)}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white">{getPlatformName(file.platform)}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">v{file.version}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-gray-200 font-medium">{formatFileSize(file.size)}</div>
                            <div className="mt-1">
                              {file.description ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 max-w-xs group-hover:line-clamp-none transition-all cursor-help" title={file.description}>
                                  <span className="font-bold text-blue-600 dark:text-blue-400 mr-1 italic">Changelog:</span>
                                  {file.description}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 dark:text-gray-600 italic">No description</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {file.isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50 shadow-sm">
                                <FaCheck className="mr-1.5" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(file.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleDownloadFile(file.id)}
                                className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Download"
                              >
                                <FaDownload />
                              </button>
                              {!file.isActive && (
                                <button
                                  onClick={() => handleSetActive(file.id)}
                                  className="p-2 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                  title="Promote to Active"
                                >
                                  <FaCheck />
                                </button>
                              )}
                              <button
                                onClick={() => confirmDeleteFile(file.id)}
                                className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
