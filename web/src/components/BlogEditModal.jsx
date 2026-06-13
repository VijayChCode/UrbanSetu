import React, { useState, useEffect } from 'react';
import { FaTimes, FaImage, FaVideo, FaTags, FaPencilAlt, FaPlus, FaCloudUploadAlt, FaPlay } from 'react-icons/fa';
import { toast } from 'react-toastify';
import ImagePreview from './ImagePreview';
import VideoPreview from './VideoPreview';
import MarkdownEditor from './MarkdownEditor';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

const BlogEditModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  properties,
  categories,
  propertySearch,
  setPropertySearch,
  isEdit = false
}) => {
  const GUIDE_CATEGORIES = [
    'Home Buying',
    'Rent',
    'Home Selling',
    'Legal',
    'Investment',
    'City Guide'
  ];

  const currentCategories = formData.type === 'guide' ? GUIDE_CATEGORIES : categories;
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false); // Global uploading state for thumbnail
  const [uploadingMedia, setUploadingMedia] = useState({}); // Per-index uploading state
  const [mediaErrors, setMediaErrors] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const isGuide = formData.type === 'guide';
  const contentLabel = isGuide ? 'Guide' : 'Blog';

  const [initialData, setInitialData] = useState(null);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

  const hasChanges = () => {
    if (!initialData) return false;
    const keys = [
      'title', 'content', 'excerpt', 'thumbnail', 
      'propertyId', 'category', 'type', 'featured', 
      'published', 'scheduledAt'
    ];
    for (const key of keys) {
      const initialVal = initialData[key] ?? '';
      const currentVal = formData[key] ?? '';
      if (key === 'scheduledAt') {
        const d1 = initialData[key] ? new Date(initialData[key]).getTime() : 0;
        const d2 = formData[key] ? new Date(formData[key]).getTime() : 0;
        if (d1 !== d2) return true;
      } else if (initialVal !== currentVal) {
        return true;
      }
    }
    const arrayKeys = ['tags', 'imageUrls', 'videoUrls'];
    for (const key of arrayKeys) {
      const arr1 = initialData[key] || [];
      const arr2 = formData[key] || [];
      if (arr1.length !== arr2.length) return true;
      for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return true;
      }
    }
    return false;
  };

  const handleClose = () => {
    if (hasChanges()) {
      setShowConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  // --- Handlers for List-based Media Input (Like CreateListing) ---

  const handleMediaUrlChange = (index, value, type) => {
    if (type === 'image') {
      const newUrls = [...(formData.imageUrls || [])];
      newUrls[index] = value;
      setFormData(prev => ({ ...prev, imageUrls: newUrls }));

      // Clear error if valid-ish
      if (value) {
        setMediaErrors(prev => {
          const newErr = { ...prev };
          delete newErr[`img-${index}`];
          return newErr;
        });
      }
    } else {
      const newUrls = [...(formData.videoUrls || [])];
      newUrls[index] = value;
      setFormData(prev => ({ ...prev, videoUrls: newUrls }));

      if (value) {
        setMediaErrors(prev => {
          const newErr = { ...prev };
          delete newErr[`vid-${index}`];
          return newErr;
        });
      }
    }
  };

  const handleSpecificFileUpload = async (index, file, type) => {
    if (!file) return;

    // Validate size
    const limit = type === 'image' ? 10 : 100;
    if (file.size > limit * 1024 * 1024) {
      setMediaErrors(prev => ({ ...prev, [`${type === 'image' ? 'img' : 'vid'}-${index}`]: `File exceeds ${limit}MB limit.` }));
      return;
    }

    const key = `${type === 'image' ? 'img' : 'vid'}-${index}`;
    setUploadingMedia(prev => ({ ...prev, [key]: true }));
    setMediaErrors(prev => {
      const newErr = { ...prev };
      delete newErr[key];
      return newErr;
    });

    try {
      const bodyFormData = new FormData();
      bodyFormData.append(type === 'image' ? 'image' : 'video', file);

      const response = await authenticatedFetch(`${API_BASE_URL}/api/upload/${type}`, {
        method: 'POST',
        body: bodyFormData
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      const url = type === 'image' ? data.imageUrl : data.videoUrl;

      if (type === 'image') {
        const newUrls = [...(formData.imageUrls || [])];
        newUrls[index] = url;
        setFormData(prev => ({ ...prev, imageUrls: newUrls }));
      } else {
        const newUrls = [...(formData.videoUrls || [])];
        newUrls[index] = url;
        setFormData(prev => ({ ...prev, videoUrls: newUrls }));
      }
    } catch (error) {
      console.error(error);
      setMediaErrors(prev => ({ ...prev, [key]: 'Upload failed. Try again.' }));
    } finally {
      setUploadingMedia(prev => ({ ...prev, [key]: false }));
    }
  };

  const addMediaField = (type) => {
    if (type === 'image') {
      setFormData(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), ''] }));
    } else {
      setFormData(prev => ({ ...prev, videoUrls: [...(prev.videoUrls || []), ''] }));
    }
  };

  const removeMediaField = (index, type) => {
    if (type === 'image') {
      setFormData(prev => ({
        ...prev,
        imageUrls: (prev.imageUrls || []).filter((_, i) => i !== index)
      }));
      // Cleanup errors/states could be done here but standard React updates handle it usually via key/index resort. 
      // For robustness we might reset errors, but lazy way is fine for now.
    } else {
      setFormData(prev => ({
        ...prev,
        videoUrls: (prev.videoUrls || []).filter((_, i) => i !== index)
      }));
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  // Keep thumbnail upload as is
  const handleThumbnailUpload = async (e) => {
    // ... existing logic ...
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Thumbnail image size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const bodyFormData = new FormData();
      bodyFormData.append('image', file);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: bodyFormData
      });
      if (!response.ok) throw new Error('Failed to upload thumbnail');
      const data = await response.json();
      setFormData(prev => ({ ...prev, thumbnail: data.imageUrl }));
    } catch (error) {
      console.error('Thumbnail upload error:', error);
      toast.error('Failed to upload thumbnail');
    } finally {
      setUploading(false);
    }
  };

  // Lock body scroll and snapshot initial form data when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Snapshot the initial form data
      setInitialData(JSON.parse(JSON.stringify(formData)));
      setShowConfirmDiscard(false);
    } else {
      document.body.style.overflow = 'unset';
      setInitialData(null);
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-2 sm:p-4 animate-fade-in transition-all">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden transform animate-slideUp border border-gray-100 dark:border-gray-700 flex flex-col transition-colors duration-300">

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-5 sm:p-7 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl">
                {isEdit ? <FaPencilAlt className="text-blue-600 dark:text-blue-400 text-xl" /> : <FaPlus className="text-blue-600 dark:text-blue-400 text-xl" />}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                {isEdit ? `Edit ${contentLabel}` : `Create New ${contentLabel}`}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all duration-300 active:scale-95 shadow-sm hover:shadow"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-5 sm:p-8 custom-scrollbar">
          <form onSubmit={onSubmit} className="space-y-8 pb-10">
            {/* Title Section */}
            <div className="group">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wider">📝 {contentLabel} Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 font-bold placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Hook your audience with a catchy title..."
                required
              />
            </div>

            {/* Excerpt Section */}
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wider">📄 Short Excerpt</label>
              <textarea
                value={formData.excerpt}
                onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                rows={3}
                className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 font-medium placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                placeholder="A brief summary that appears in search results and cards..."
              />
            </div>

            {/* Content Section */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 ml-1 uppercase tracking-wider">
                📖 Rich Content <span className="text-red-500">*</span>
              </label>
              <MarkdownEditor
                value={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                placeholder="Write your story using Markdown. Use the toolbar for quick formatting!"
              />
            </div>

            {/* Media Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 dark:bg-gray-700/30 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">

              {/* Thumbnail */}
              <div className="space-y-4">
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">🖼️ Main Thumbnail</label>
                <div className="flex flex-col gap-4">
                  {/* Input Row */}
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Paste Thumbnail URL..."
                      value={formData.thumbnail || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, thumbnail: e.target.value }))}
                      className="flex-1 px-4 py-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors text-sm font-medium border-gray-200"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                      id="thumbnail-upload"
                    />
                    <label
                      htmlFor="thumbnail-upload"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl cursor-pointer transition-colors shadow-sm flex items-center gap-2"
                    >
                      {uploading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaCloudUploadAlt />}
                      <span className="hidden sm:inline text-xs font-bold uppercase">Upload</span>
                    </label>
                    {formData.thumbnail && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, thumbnail: '' }))}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl transition-colors shadow-sm"
                        title="Remove thumbnail"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>

                  {/* Preview Area */}
                  {formData.thumbnail && (
                    <div
                      className="relative group overflow-hidden rounded-2xl shadow-xl aspect-video bg-gray-200 dark:bg-gray-800 cursor-pointer border border-gray-200 dark:border-gray-700"
                      onClick={() => setPreviewImage(formData.thumbnail)}
                    >
                      <img
                        src={formData.thumbnail}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                        {/* Simple visual cue on hover */}
                      </div>
                    </div>
                  )}

                  {/* Empty State Placeholder (only if no thumbnail) */}
                  {!formData.thumbnail && (
                    <div className="p-8 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                      <FaImage className="text-3xl mb-2 opacity-50" />
                      <span className="text-xs font-bold uppercase tracking-wider">No Thumbnail Selected</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Media */}
              {/* Additional Media */}
              <div className="space-y-8">
                {/* Blog Images */}
                <div className="space-y-4">
                  <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    📸 {contentLabel} Availability Images
                  </label>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
                    Upload images or paste URLs directly.
                  </p>

                  <div className="space-y-3">
                    {formData.imageUrls?.map((url, index) => (
                      <div key={`img-input-${index}`} className="space-y-2 animate-fade-in">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder={`Image URL ${index + 1}`}
                            value={url || ""}
                            onChange={(e) => handleMediaUrlChange(index, e.target.value, 'image')}
                            className={`flex-1 px-4 py-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors text-sm font-medium ${mediaErrors[`img-${index}`] ? 'border-red-500' : 'border-gray-200'}`}
                          />
                          <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl cursor-pointer transition-colors shadow-sm flex items-center gap-2">
                            {uploadingMedia[`img-${index}`] ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaCloudUploadAlt />}
                            <span className="hidden sm:inline text-xs font-bold uppercase">Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleSpecificFileUpload(index, e.target.files[0], 'image')}
                              className="hidden"
                              disabled={uploadingMedia[`img-${index}`]}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeMediaField(index, 'image')}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl transition-colors shadow-sm"
                            title="Remove image"
                          >
                            <FaTimes />
                          </button>
                        </div>
                        {mediaErrors[`img-${index}`] && (
                          <p className="text-red-500 text-xs font-bold ml-1">{mediaErrors[`img-${index}`]}</p>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addMediaField('image')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      <FaPlus /> Add Additional Photo
                    </button>
                  </div>

                  {/* Image Previews Grid */}
                  {formData.imageUrls?.some(u => u) && (
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {formData.imageUrls.map((url, idx) => (
                        url && (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setPreviewImage(url)}>
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>

                {/* Blog Videos */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    🎥 {contentLabel} Videos
                  </label>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
                    Upload videos or paste URLs directly.
                  </p>

                  <div className="space-y-3">
                    {formData.videoUrls?.map((url, index) => (
                      <div key={`vid-input-${index}`} className="space-y-2 animate-fade-in">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder={`Video URL ${index + 1}`}
                            value={url || ""}
                            onChange={(e) => handleMediaUrlChange(index, e.target.value, 'video')}
                            className={`flex-1 px-4 py-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-colors text-sm font-medium ${mediaErrors[`vid-${index}`] ? 'border-red-500' : 'border-gray-200'}`}
                          />
                          <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl cursor-pointer transition-colors shadow-sm flex items-center gap-2">
                            {uploadingMedia[`vid-${index}`] ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaCloudUploadAlt />}
                            <span className="hidden sm:inline text-xs font-bold uppercase">Upload</span>
                            <input
                              type="file"
                              accept="video/*"
                              onChange={(e) => handleSpecificFileUpload(index, e.target.files[0], 'video')}
                              className="hidden"
                              disabled={uploadingMedia[`vid-${index}`]}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeMediaField(index, 'video')}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl transition-colors shadow-sm"
                            title="Remove video"
                          >
                            <FaTimes />
                          </button>
                        </div>
                        {mediaErrors[`vid-${index}`] && (
                          <p className="text-red-500 text-xs font-bold ml-1">{mediaErrors[`vid-${index}`]}</p>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addMediaField('video')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                    >
                      <FaPlus /> Add Video Content
                    </button>
                  </div>

                  {/* Video Previews Grid */}
                  {formData.videoUrls?.some(u => u) && (
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {formData.videoUrls.map((url, idx) => (
                        url && (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-black cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setPreviewVideo(url)}>
                            <video src={url} className="w-full h-full object-cover opacity-60" />
                            <div className="absolute inset-0 flex items-center justify-center text-white"><FaPlay className="drop-shadow-md" /></div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content Type & Featured Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
              {/* Content Type */}
              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wider">📌 Content Type</label>
                <div className="flex gap-4">
                  <label className={`flex-1 cursor-pointer p-4 rounded-xl border transition-all ${formData.type === 'blog' ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-[1.02]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                    <input
                      type="radio"
                      name="contentType"
                      value="blog"
                      checked={!formData.type || formData.type === 'blog'}
                      onChange={() => setFormData(prev => ({ ...prev, type: 'blog', category: 'Real Estate Tips' }))}
                      className="hidden"
                    />
                    <div className="text-center font-bold">Blog Post</div>
                    <div className={`text-xs text-center mt-1 ${formData.type === 'blog' ? 'text-blue-100' : 'text-gray-500'}`}>Standard article</div>
                  </label>
                  <label className={`flex-1 cursor-pointer p-4 rounded-xl border transition-all ${formData.type === 'guide' ? 'bg-purple-600 border-purple-600 text-white shadow-lg scale-[1.02]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}>
                    <input
                      type="radio"
                      name="contentType"
                      value="guide"
                      checked={formData.type === 'guide'}
                      onChange={() => setFormData(prev => ({ ...prev, type: 'guide', category: 'Home Buying' }))}
                      className="hidden"
                    />
                    <div className="text-center font-bold">Guide</div>
                    <div className={`text-xs text-center mt-1 ${formData.type === 'guide' ? 'text-purple-100' : 'text-gray-500'}`}>Structured learning</div>
                  </label>
                </div>
              </div>

              {/* Featured Toggle */}
              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wider">🌟 Visibility</label>
                <label className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 transition-colors h-[82px]">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 dark:text-white">Mark as Featured</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formData.type === 'guide' ? 'Show in top carousel' : 'Highlight on home page'}</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Categorization Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wider">🏷️ Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-5 py-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 font-bold appearance-none cursor-pointer transition-all"
                >
                  <option value="" disabled>Select a {contentLabel} Category</option>
                  {currentCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wider">🏠 Link to Property</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    placeholder="Search by ID or Title..."
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 font-medium placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <select
                    value={formData.propertyId}
                    onChange={(e) => setFormData(prev => ({ ...prev, propertyId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-400 font-bold transition-all"
                  >
                    <option value="">Global Blog (No property)</option>
                    {properties
                      .filter((p) => {
                        const s = propertySearch.trim().toLowerCase();
                        if (!s) return true;
                        return (p.name || "").toLowerCase().includes(s) || (p._id || "").toLowerCase().includes(s);
                      })
                      .map(p => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.city})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 ml-1 uppercase tracking-wider">🏷️ Tags & Keywords</label>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[44px] p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
                {formData.tags?.length === 0 && <span className="text-gray-400 dark:text-gray-500 text-sm py-1">Add keywords to reach more people...</span>}
                {formData.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-md animate-scale-in"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(index)}
                      className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                    >
                      <FaTimes className="text-[10px]" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Type a tag and press Enter..."
                  className="flex-1 px-5 py-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-400 font-bold placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-6 py-4 bg-gray-900 dark:bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-600 dark:hover:bg-blue-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <FaPlus />
                </button>
              </div>
            </div>

            {/* Status & Scheduling Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-3xl border border-blue-100 dark:border-blue-800 shadow-sm transition-all duration-300">
              {/* Manual Publish */}
              <label className="flex items-center group cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.published}
                    onChange={(e) => {
                      const isPublished = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        published: isPublished,
                        scheduledAt: isPublished ? null : prev.scheduledAt
                      }));
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-all duration-300"></div>
                  <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-all duration-300 peer-checked:translate-x-6 shadow-sm"></div>
                </div>
                <div className="ml-4">
                  <span className="block text-base font-black text-gray-800 dark:text-white tracking-tight">🚀 Publish Now</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Visible to all users immediately</span>
                </div>
              </label>

              {/* Scheduling */}
              <div className={`transition-all duration-500 ${formData.published ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest ml-1">📅 Or Schedule Publication</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt ? new Date(new Date(formData.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const localValue = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      scheduledAt: localValue ? new Date(localValue).toISOString() : null
                    }));
                  }}
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  disabled={formData.published}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800/90 backdrop-blur-md border-t border-gray-100 dark:border-gray-700 p-5 sm:p-7 flex flex-col sm:flex-row justify-end gap-3 z-10 transition-colors duration-300">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 sm:flex-none px-8 py-4 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl font-black hover:bg-gray-100 dark:hover:bg-gray-600 transition-all active:scale-95 border border-gray-200 dark:border-gray-600 shadow-sm"
          >
            DISCARD
          </button>
          <button
            type="submit"
            form="blog-form"
            onClick={(e) => {
              // The form is handled by onSubmit of the form element
              // But since we scroll the form, we might need a reference or just triggers it
            }}
            className="flex-1 sm:flex-none px-12 py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl font-black hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/30 active:scale-95 tracking-widest uppercase text-sm"
          >
            {isEdit ? 'Update Details' : `Launch ${contentLabel}`}
          </button>
        </div>

        {/* Hidden form trigger for footer button */}
        <form
          id="blog-form"
          onSubmit={onSubmit}
          className="hidden"
        />
      </div >
      {previewImage && (
        <ImagePreview
          isOpen={!!previewImage}
          images={[previewImage]}
          onClose={() => setPreviewImage(null)}
        />
      )}
      {
        previewVideo && (
          <VideoPreview
            isOpen={!!previewVideo}
            videos={[previewVideo]}
            onClose={() => setPreviewVideo(null)}
          />
        )
      }
      {showConfirmDiscard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-scale-in border border-gray-100 dark:border-gray-700 p-6 text-center">
            <div className="w-16 h-16 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-200 dark:border-yellow-800 text-2xl">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Unsaved Changes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              You have unsaved changes in this {contentLabel.toLowerCase()}. Are you sure you want to discard them?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDiscard(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm transition-all"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowConfirmDiscard(false);
                  onClose();
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default BlogEditModal;
