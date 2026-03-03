import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useLocation, useBlocker } from "react-router-dom";
import LocationSelector from "../components/LocationSelector";
import ESGManagement from "../components/ESGManagement";
import { toast } from 'react-toastify';
import { usePageTitle } from '../hooks/usePageTitle';
import { FaCompass, FaPlay } from "react-icons/fa";
import VideoPreview from '../components/VideoPreview';
import { authenticatedFetch } from '../utils/auth';
import { useImageAuditor } from '../hooks/useImageAuditor';
import { FaBrain, FaExclamationTriangle, FaCheckCircle, FaLightbulb } from 'react-icons/fa';
import ImagePreview from '../components/ImagePreview';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CreateListing() {
  // Set page title
  usePageTitle("Create Listing - Add New Property");

  const [formData, setFormData] = useState({
    imageUrls: [],
    virtualTourImages: [], // New state for 360 images
    videoUrls: [],
    name: "",
    description: "",
    // Structured address fields
    propertyNumber: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    // Legacy address field for backward compatibility
    address: "",
    type: "sale",
    bedrooms: 1,
    bathrooms: 1,
    regularPrice: 0,
    discountPrice: 0,
    offer: false,
    parking: false,
    furnished: false,
    locationLink: "",
    area: "",
    floor: "",
    propertyAge: "",
    // ESG Data
    esg: {
      environmental: {
        energyRating: 'Not Rated',
        carbonFootprint: 0,
        renewableEnergy: false,
        waterEfficiency: 'Not Rated',
        wasteManagement: 'Not Rated',
        greenCertification: 'None',
        solarPanels: false,
        rainwaterHarvesting: false
      },
      social: {
        accessibility: 'Not Rated',
        communityImpact: 0,
        affordableHousing: false,
        localEmployment: 0,
        socialAmenities: [],
        diversityInclusion: 'Not Rated'
      },
      governance: {
        transparency: 'Not Rated',
        ethicalStandards: 'Not Rated',
        compliance: 'Not Rated',
        riskManagement: 'Not Rated',
        stakeholderEngagement: 'Not Rated'
      }
    },
    // Rent-Lock Plan Configuration (for rental properties)
    rentLockPlans: {
      availablePlans: [],
      defaultPlan: '1_year'
    },
    monthlyRent: 0,
    securityDepositMonths: 2,
    maintenanceCharges: 0,
    advanceRentMonths: 0,
    customLockDuration: 12, // in months, if custom plan
    imageCaptions: {} // Map of index -> caption string
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [uploadingImages, setUploadingImages] = useState({});
  const [virtualTourErrors, setVirtualTourErrors] = useState({}); // Errors for 360 images
  const [uploadingVirtualTour, setUploadingVirtualTour] = useState({}); // Uplodaing state for 360
  const [videoErrors, setVideoErrors] = useState({});
  const [uploadingVideos, setUploadingVideos] = useState({});
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [consent, setConsent] = useState(false);
  // LocationSelector state
  const [locationState, setLocationState] = useState({ state: "", district: "", city: "", cities: [] });
  const [previewVideo, setPreviewVideo] = useState(null);
  const [syncImagesTo360, setSyncImagesTo360] = useState(false);
  const [initialDataStr, setInitialDataStr] = useState('');

  useEffect(() => {
    // Only set once when component mounts
    setInitialDataStr(JSON.stringify(formData));
    // eslint-disable-next-line
  }, []);

  const hasUnsavedChanges = initialDataStr !== '' && JSON.stringify(formData) !== initialDataStr;

  // Window beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Block internal navigation
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (confirmLeave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Image Preview State
  const [previewImages, setPreviewImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const openPreview = (index, sourceArray) => {
    const validImages = sourceArray.filter(url => url && url.length > 0);
    const clickedUrl = sourceArray[index];
    const validIndex = validImages.indexOf(clickedUrl);

    if (validIndex !== -1) {
      setPreviewImages(validImages);
      setPreviewIndex(validIndex);
      setIsPreviewOpen(true);
    }
  };

  // AI Image Auditor Hook
  const { performAudit, auditByUrl, auditResults, isAuditing, setAuditResults } = useImageAuditor();

  // Get the previous path for redirection
  const getPreviousPath = () => {
    const from = location.state?.from;
    if (from) return from;

    // Default paths based on user role
    if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
      return "/admin/my-listings";
    } else {
      return "/user/my-listings";
    }
  };

  // Check if Property Images are already present in 360 View on load
  useEffect(() => {
    if (formData.imageUrls && formData.imageUrls.length > 0 && formData.virtualTourImages && formData.virtualTourImages.length > 0) {
      const validPropertyImages = formData.imageUrls.filter(url => url && url.trim() !== '');
      if (validPropertyImages.length > 0) {
        const isSynced = validPropertyImages.every(url => formData.virtualTourImages.includes(url));
        if (isSynced) {
          setSyncImagesTo360(true);
        }
      }
    }
    // eslint-disable-next-line
  }, []);

  // Update formData when location changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      state: locationState.state,
      city: locationState.city || "",
    }));
  }, [locationState]);

  const validateImageUrl = (url) => {
    if (!url) return true;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return false;
    }

    // Check if it's an image URL
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext =>
      url.toLowerCase().includes(ext)
    );

    // Check for Cloudinary URLs (they contain 'cloudinary.com')
    const isCloudinaryUrl = url.includes('cloudinary.com');

    return hasImageExtension || url.includes('images') || url.includes('img') || isCloudinaryUrl;
  };

  const validateVideoUrl = (url) => {
    if (!url) return true;
    try {
      new URL(url);
    } catch {
      return false;
    }
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.mkv'];
    const hasVideoExtension = videoExtensions.some(ext => url.toLowerCase().includes(ext));
    const isCloudinaryUrl = url.includes('cloudinary.com');
    return hasVideoExtension || url.includes('video') || isCloudinaryUrl;
  };

  const handleImageChange = (index, url) => {
    const newImageUrls = [...formData.imageUrls];
    newImageUrls[index] = url;
    setFormData({ ...formData, imageUrls: newImageUrls });

    // Validate image URL
    const newImageErrors = { ...imageErrors };
    if (url && !validateImageUrl(url)) {
      newImageErrors[index] = "Please enter a valid image URL";
    } else {
      delete newImageErrors[index];
    }
    setImageErrors(newImageErrors);

    // Trigger AI Audit for URL
    if (url && validateImageUrl(url)) {
      auditByUrl(url, index, 'main');
    }

    // Sync to 360 view if enabled
    if (syncImagesTo360 && formData.isVerified) {
      const oldUrl = formData.imageUrls[index];
      setFormData(prev => {
        let current360 = [...(prev.virtualTourImages || [])];

        let found = false;
        if (oldUrl) {
          current360 = current360.map(img => {
            if (img === oldUrl) {
              found = true;
              return url;
            }
            return img;
          });
        }

        if (!found && url) {
          if (!current360.includes(url)) {
            current360.push(url);
          }
        }

        return {
          ...prev,
          imageUrls: newImageUrls,
          virtualTourImages: current360
        };
      });
    }
  };

  const handleFileUpload = async (index, file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageErrors(prev => ({ ...prev, [index]: 'Please select an image file' }));
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setImageErrors(prev => ({ ...prev, [index]: 'File size must be less than 10MB' }));
      return;
    }

    setUploadingImages(prev => ({ ...prev, [index]: true }));
    setImageErrors(prev => ({ ...prev, [index]: '' }));

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await res.json();

      if (res.ok) {
        // Perform AI Audit
        performAudit(file, index, 'main');

        // Update the image URL with the uploaded image URL
        const newImageUrls = [...formData.imageUrls];
        newImageUrls[index] = data.imageUrl;

        setFormData(prev => {
          const updatedData = { ...prev, imageUrls: newImageUrls };
          // Sync to 360 view if enabled
          if (syncImagesTo360 && prev.isVerified) {
            const current360 = [...(prev.virtualTourImages || [])];
            // Append if unique
            if (data.imageUrl && !current360.includes(data.imageUrl)) {
              current360.push(data.imageUrl);
            }
            updatedData.virtualTourImages = current360;
          }
          return updatedData;
        });

        // Clear any existing errors for this image
        setImageErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
      } else {
        setImageErrors(prev => ({ ...prev, [index]: data.message || 'Upload failed' }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setImageErrors(prev => ({ ...prev, [index]: 'Upload failed. Please try again.' }));
    } finally {
      setUploadingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleVideoUrlChange = (index, url) => {
    const newVideoUrls = [...formData.videoUrls];
    newVideoUrls[index] = url;
    setFormData({ ...formData, videoUrls: newVideoUrls });
    const newVideoErrors = { ...videoErrors };
    if (url && !validateVideoUrl(url)) {
      newVideoErrors[index] = 'Please enter a valid video URL';
    } else {
      delete newVideoErrors[index];
    }
    setVideoErrors(newVideoErrors);
  };

  const handleVideoUpload = async (index, file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setVideoErrors(prev => ({ ...prev, [index]: 'Please select a video file' }));
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setVideoErrors(prev => ({ ...prev, [index]: 'File size must be less than 100MB' }));
      return;
    }
    setUploadingVideos(prev => ({ ...prev, [index]: true }));
    setVideoErrors(prev => ({ ...prev, [index]: '' }));
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('video', file);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: uploadFormData,
      });
      const data = await res.json();
      if (res.ok) {
        const newVideoUrls = [...formData.videoUrls];
        newVideoUrls[index] = data.videoUrl;
        setFormData(prev => ({ ...prev, videoUrls: newVideoUrls }));
        setVideoErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
      } else {
        setVideoErrors(prev => ({ ...prev, [index]: data.message || 'Upload failed' }));
      }
    } catch (error) {
      console.error('Video upload error:', error);
      setVideoErrors(prev => ({ ...prev, [index]: 'Upload failed. Please try again.' }));
    } finally {
      setUploadingVideos(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleCaptionChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      imageCaptions: {
        ...prev.imageCaptions,
        [index]: value
      }
    }));
  };

  const onHandleRemoveImage = (index) => {
    const newImageUrls = formData.imageUrls.filter((_, i) => i !== index);

    // Shift image captions
    const newCaptions = { ...formData.imageCaptions };
    // We need to rebuild the captions map for the new indices
    const shiftedCaptions = {};
    Object.keys(newCaptions).forEach(key => {
      const keyIdx = parseInt(key);
      if (keyIdx < index) {
        shiftedCaptions[keyIdx] = newCaptions[key];
      } else if (keyIdx > index) {
        shiftedCaptions[keyIdx - 1] = newCaptions[key];
      }
      // Index equal to removed index is skipped (deleted)
    });

    setFormData(prev => {
      const updatedData = {
        ...prev,
        imageUrls: newImageUrls,
        imageCaptions: shiftedCaptions
      };
      // Sync to 360 view if enabled
      if (syncImagesTo360 && prev.isVerified) {
        const removedUrl = prev.imageUrls[index];
        if (removedUrl) {
          updatedData.virtualTourImages = (prev.virtualTourImages || []).filter(url => url !== removedUrl);
        }
      }
      return updatedData;
    });

    // Clear error for this image
    const newImageErrors = { ...imageErrors };
    delete newImageErrors[index];
    setImageErrors(newImageErrors);

    // Clear uploading state
    const newUploadingImages = { ...uploadingImages };
    delete newUploadingImages[index];
    setUploadingImages(newUploadingImages);

    // RE-INDEX Audit Results to prevent shifting bugs
    const newAuditResults = { ...auditResults };
    delete newAuditResults[`main_${index}`];

    for (let i = index + 1; i < formData.imageUrls.length; i++) {
      if (newAuditResults[`main_${i}`]) {
        newAuditResults[`main_${i - 1}`] = newAuditResults[`main_${i}`];
        delete newAuditResults[`main_${i}`];
      }
    }
    setAuditResults(newAuditResults);
  };

  const onHandleRemoveVideo = (index) => {
    setFormData({
      ...formData,
      videoUrls: formData.videoUrls.filter((_, i) => i !== index),
    });
    const newVideoErrors = { ...videoErrors };
    delete newVideoErrors[index];
    setVideoErrors(newVideoErrors);
    const newUploadingVideos = { ...uploadingVideos };
    delete newUploadingVideos[index];
    setUploadingVideos(newUploadingVideos);
  };

  // --- Virtual Tour (360) Handlers ---

  const handleVirtualTourUpload = async (index, file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setVirtualTourErrors(prev => ({ ...prev, [index]: 'Please select an image file' }));
      return;
    }

    // Validate file size (10MB limit for 360 images as they are larger)
    if (file.size > 10 * 1024 * 1024) {
      setVirtualTourErrors(prev => ({ ...prev, [index]: 'File size must be less than 10MB' }));
      return;
    }

    setUploadingVirtualTour(prev => ({ ...prev, [index]: true }));
    setVirtualTourErrors(prev => ({ ...prev, [index]: '' }));

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      // We use the same image upload endpoint, it handles cloudinary
      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await res.json();

      if (res.ok) {
        // Perform AI Audit
        performAudit(file, index, 'tour');

        const newVirtualTourImages = [...(formData.virtualTourImages || [])];
        newVirtualTourImages[index] = data.imageUrl;
        setFormData(prev => ({ ...prev, virtualTourImages: newVirtualTourImages }));

        setVirtualTourErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
      } else {
        setVirtualTourErrors(prev => ({ ...prev, [index]: data.message || 'Upload failed' }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setVirtualTourErrors(prev => ({ ...prev, [index]: 'Upload failed. Please try again.' }));
    } finally {
      setUploadingVirtualTour(prev => ({ ...prev, [index]: false }));
    }
  };

  const onHandleRemoveVirtualTour = (index) => {
    setFormData({
      ...formData,
      virtualTourImages: formData.virtualTourImages.filter((_, i) => i !== index),
    });
    const newErrors = { ...virtualTourErrors };
    delete newErrors[index];
    setVirtualTourErrors(newErrors);

    const newUploading = { ...uploadingVirtualTour };
    delete newUploading[index];
    setUploadingVirtualTour(newUploading);
  };

  const handleVirtualTourUrlChange = (index, url) => {
    const newImages = [...(formData.virtualTourImages || [])];
    newImages[index] = url;
    setFormData({ ...formData, virtualTourImages: newImages });

    // Trigger AI Audit for 360 URL
    if (url && validateImageUrl(url)) {
      auditByUrl(url, index, 'tour');
    }
  };


  const onHandleChanges = (e) => {
    const { id, value, checked, type, name } = e.target;
    let newValue = type === "checkbox" ? checked : value;

    if (["regularPrice", "discountPrice", "bedrooms", "bathrooms"].includes(id)) {
      newValue = Number(value);
    }

    setFormData({
      ...formData,
      [name || id]: newValue,
    });
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();

    if (!formData.type) return setError("Please select a listing type (Sale or Rent)");

    // Validate rent-lock plan configuration for rental properties
    if (formData.type === "rent") {
      if (formData.rentLockPlans.availablePlans.length === 0) {
        return setError("Please select at least one available rent-lock plan.");
      }
      if (!formData.monthlyRent || formData.monthlyRent <= 0) {
        return setError("Please enter a valid monthly rent amount.");
      }
      if (!formData.securityDepositMonths || formData.securityDepositMonths < 0) {
        return setError("Please enter a valid security deposit (months of rent).");
      }
      if (formData.rentLockPlans.defaultPlan === "custom" && (!formData.customLockDuration || formData.customLockDuration < 1 || formData.customLockDuration > 60)) {
        return setError("Custom lock duration must be between 1 and 60 months.");
      }
      if (formData.maintenanceCharges < 0) {
        return setError("Maintenance charges cannot be negative.");
      }
      if (formData.advanceRentMonths < 0 || formData.advanceRentMonths > 12) {
        return setError("Advance rent must be between 0 and 12 months.");
      }
    }

    // Images are optional
    if (formData.regularPrice < formData.discountPrice)
      return setError("Discount price should be less than regular price");

    // Validate required address fields
    if (!formData.propertyNumber) return setError("Property number is required");
    if (!formData.city) return setError("City is required");
    if (!formData.state) return setError("State is required");
    if (!formData.pincode) return setError("Pincode is required");

    // Check for image errors
    if (Object.keys(imageErrors).length > 0) {
      return setError("Please fix the image URL errors before submitting");
    }
    // Check for video errors
    if (Object.keys(videoErrors).length > 0) {
      return setError("Please fix the video URL errors before submitting");
    }

    // Only require consent for non-admin users
    if ((currentUser.role !== 'admin' && currentUser.role !== 'rootadmin') && !consent) {
      return setError('You must confirm that the data provided is genuine.');
    }

    // AI AUDIT VALIDATION: Ensure all uploaded images are audited
    const uploadedImagesCount = formData.imageUrls.filter(url => url !== "").length;
    const uploadedToursCount = (formData.virtualTourImages || []).filter(url => url !== "").length;

    // Check main images
    const auditedMainImagesKeys = Object.keys(auditResults).filter(key => key.startsWith('main_'));
    const auditedTourImagesKeys = Object.keys(auditResults).filter(key => key.startsWith('tour_'));

    if (uploadedImagesCount === 0) {
      toast.error("At least one property image is required.");
      return setError("Please upload at least one image of the property.");
    }

    if (auditedMainImagesKeys.length < uploadedImagesCount || auditedTourImagesKeys.length < uploadedToursCount) {
      toast.error("All uploaded images must be AI Audited before submitting.");
      return setError("Mandatory Step: Please click the brain icon for each image to audit them first.");
    }

    setLoading(true);
    setError("");

    try {
      console.log("Sending form data:", formData);
      console.log("ESG data being sent:", formData.esg);

      // Prepare submission data
      const submissionData = {
        ...formData,
        userRef: currentUser._id,
        aiAuditResults: auditResults // Saving AI Audit results to database
      };

      // For rentals, sync regular price with monthly rent
      if (submissionData.type === 'rent') {
        submissionData.regularPrice = submissionData.monthlyRent;
        submissionData.discountPrice = 0;
      }

      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success("Property Added Successfully!!");
        const newListingId = data.listing?._id || data._id;

        // If rental property, suggest verification and auto-generate prediction
        if (formData.type === "rent") {
          // Auto-generate rent prediction in background
          authenticatedFetch(`${API_BASE_URL}/api/rental/predictions/${newListingId}`, {
            method: 'POST',
          }).catch(err => console.error('Error generating prediction:', err));

          setTimeout(() => {
            toast.info(
              <div>
                <p className="mb-2">Get your property verified to build trust!</p>
                <button
                  onClick={() => navigate(`/user/property-verification?listingId=${newListingId}`)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  Request Verification
                </button>
              </div>,
              { autoClose: 8000 }
            );
          }, 1000);
        }
        navigate(getPreviousPath());
      } else {
        const errorMessage = data.message || "Failed to create listing";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error.message || "An error occurred while creating the listing";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-950 dark:to-gray-900 min-h-screen py-10 px-2 md:px-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-6 relative transition-colors">
        <h3 className="text-3xl font-extrabold text-blue-700 dark:text-blue-500 mb-6 text-center drop-shadow">
          Create a Listing
        </h3>

        <form onSubmit={onSubmitForm} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                id="name"
                placeholder="Property Name"
                required
                onChange={onHandleChanges}
                value={formData.name}
                className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              />
            </div>
            <textarea
              id="description"
              placeholder="Property Description"
              required
              onChange={onHandleChanges}
              value={formData.description}
              className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-4 resize-y bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              rows={4}
            />
          </div>

          {/* Address Information */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Address Information</h4>
            <div className="mb-4">
              <LocationSelector value={locationState} onChange={setLocationState} mode="form" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                id="propertyNumber"
                placeholder="Property Number/Flat Number"
                required
                onChange={onHandleChanges}
                value={formData.propertyNumber}
                className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              />
              <input
                type="text"
                id="landmark"
                placeholder="Landmark (optional)"
                onChange={onHandleChanges}
                value={formData.landmark}
                className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              />
              <input
                type="text"
                id="pincode"
                placeholder="Pincode"
                required
                onChange={onHandleChanges}
                value={formData.pincode}
                className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength="6"
                onKeyPress={(e) => {
                  if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              <input
                type="text"
                id="locationLink"
                placeholder="Google Maps Location Link (Optional)"
                onChange={onHandleChanges}
                value={formData.locationLink}
                className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              />
            </div>
          </div>

          {/* Property Type */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Property Type</h4>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="type"
                  value="sale"
                  onChange={onHandleChanges}
                  checked={formData.type === "sale"}
                  className="text-blue-600 dark:accent-blue-500"
                />
                <span className="font-medium text-gray-700 dark:text-white transition-colors">For Sale</span>
              </label>
              <label className="flex items-center gap-2 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="type"
                  value="rent"
                  onChange={onHandleChanges}
                  checked={formData.type === "rent"}
                  className="text-blue-600 dark:accent-blue-500"
                />
                <span className="font-medium text-gray-700 dark:text-white transition-colors">For Rent</span>
              </label>
            </div>
            <div className="mt-4">
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300 font-medium mb-1 transition-colors">Area (sq ft) *</span>
                <input
                  type="number"
                  id="area"
                  placeholder="Enter property area in square feet"
                  required
                  onChange={onHandleChanges}
                  value={formData.area}
                  className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                  Area refers to the total built-up area of the property including all rooms, kitchen, bathrooms, and common areas
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300 font-medium mb-1 transition-colors">Floor Number *</span>
                <input
                  type="number"
                  id="floor"
                  placeholder="Enter floor number (e.g., 0, 1, 2...)"
                  required
                  min="0"
                  onChange={onHandleChanges}
                  value={formData.floor}
                  className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                  Floor number refers to which floor the property is located on (Ground floor = 0, First floor = 1, Second floor = 2, etc.)
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300 font-medium mb-1 transition-colors">Property Age (years) *</span>
                <input
                  type="number"
                  id="propertyAge"
                  placeholder="Enter property age in years (0 for new construction)"
                  required
                  min="0"
                  onChange={onHandleChanges}
                  value={formData.propertyAge}
                  className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                  Property age refers to how many years ago the property was constructed/built
                </p>
              </div>
            </div>

            {/* Rent-Lock Plan Configuration (only for rental properties) */}
            {formData.type === "rent" && (
              <div className="mt-6 border-t dark:border-gray-700 pt-4 transition-colors">
                <h5 className="font-semibold text-gray-800 dark:text-white mb-3">Rent-Lock Plan Configuration</h5>
                <div className="space-y-4">
                  {/* Rent-Lock Plan Selection */}
                  <div className="flex flex-col">
                    <span className="text-gray-700 dark:text-gray-300 font-medium mb-2 transition-colors">Rent-Lock Plan *</span>
                    <select
                      id="rentLockPlan"
                      name="defaultPlan"
                      onChange={(e) => {
                        const selectedPlan = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          rentLockPlans: {
                            ...prev.rentLockPlans,
                            defaultPlan: selectedPlan,
                            availablePlans: prev.rentLockPlans.availablePlans.includes(selectedPlan)
                              ? prev.rentLockPlans.availablePlans
                              : [...prev.rentLockPlans.availablePlans, selectedPlan]
                          }
                        }));
                      }}
                      value={formData.rentLockPlans.defaultPlan}
                      className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    >
                      <option value="1_year">1 Year Rent-Lock</option>
                      <option value="3_year">3 Year Rent-Lock</option>
                      <option value="5_year">5 Year Rent-Lock</option>
                      <option value="custom">Custom Duration</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                      Select the rent-lock plan duration. Rent will remain fixed for this period.
                    </p>
                  </div>

                  {/* Custom Lock Duration (if custom plan selected) */}
                  {formData.rentLockPlans.defaultPlan === "custom" && (
                    <div className="flex flex-col">
                      <span className="text-gray-700 dark:text-gray-300 font-medium mb-2 transition-colors">Custom Lock Duration (months) *</span>
                      <input
                        type="number"
                        id="customLockDuration"
                        min="1"
                        max="60"
                        onChange={onHandleChanges}
                        value={formData.customLockDuration}
                        placeholder="Enter duration in months (1-60)"
                        className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                        Enter the lock duration in months (minimum 1 month, maximum 60 months).
                      </p>
                    </div>
                  )}

                  {/* Monthly Rent */}
                  <div className="flex flex-col">
                    <span className="text-gray-700 dark:text-gray-300 font-medium mb-2 transition-colors">Monthly Rent (₹) *</span>
                    <input
                      type="number"
                      id="monthlyRent"
                      min="0"
                      onChange={onHandleChanges}
                      value={formData.monthlyRent}
                      placeholder="Enter monthly rent amount"
                      className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                      The fixed monthly rent amount that will remain unchanged during the rent-lock period.
                    </p>
                  </div>

                  {/* Security Deposit */}
                  <div className="flex flex-col">
                    <span className="text-gray-700 dark:text-gray-300 font-medium mb-2 transition-colors">Security Deposit (months of rent) *</span>
                    <input
                      type="number"
                      id="securityDepositMonths"
                      min="0"
                      max="12"
                      onChange={onHandleChanges}
                      value={formData.securityDepositMonths}
                      placeholder="Enter months (typically 2-3 months)"
                      className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                      Number of months of rent as security deposit (typically 2-3 months).
                    </p>
                  </div>

                  {/* Maintenance Charges */}
                  <div className="flex flex-col">
                    <span className="text-gray-700 dark:text-gray-300 font-medium mb-2 transition-colors">Maintenance Charges (₹/month) (Optional)</span>
                    <input
                      type="number"
                      id="maintenanceCharges"
                      min="0"
                      onChange={onHandleChanges}
                      value={formData.maintenanceCharges}
                      placeholder="Enter monthly maintenance charges (0 if none)"
                      className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                      Monthly maintenance charges, if applicable. Leave 0 if no maintenance charges.
                    </p>
                  </div>

                  {/* Advance Rent */}
                  <div className="flex flex-col">
                    <span className="text-gray-700 dark:text-gray-300 font-medium mb-2 transition-colors">Advance Rent (months) (Optional)</span>
                    <input
                      type="number"
                      id="advanceRentMonths"
                      min="0"
                      max="12"
                      onChange={onHandleChanges}
                      value={formData.advanceRentMonths}
                      placeholder="Enter months of advance rent (0 if none)"
                      className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                      Number of months of rent to be paid in advance, if required. Leave 0 if no advance rent.
                    </p>
                  </div>

                  {/* Available Plans (multi-select) */}
                  <div className="flex flex-col">
                    <span className="text-gray-700 dark:text-gray-300 font-medium mb-2 transition-colors">Available Plans (Select all that apply)</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['1_year', '3_year', '5_year', 'custom'].map((plan) => (
                        <label key={plan} className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.rentLockPlans.availablePlans.includes(plan)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData(prev => ({
                                ...prev,
                                rentLockPlans: {
                                  ...prev.rentLockPlans,
                                  availablePlans: checked
                                    ? [...prev.rentLockPlans.availablePlans, plan]
                                    : prev.rentLockPlans.availablePlans.filter(p => p !== plan)
                                }
                              }));
                            }}
                            className="text-blue-600 dark:accent-blue-500"
                          />
                          <span className="text-gray-700 dark:text-white text-sm font-medium transition-colors">
                            {plan === '1_year' ? '1 Year' :
                              plan === '3_year' ? '3 Years' :
                                plan === '5_year' ? '5 Years' : 'Custom'}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                      Select all rent-lock plans you want to offer to tenants. At least one plan should be selected.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Property Details */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Property Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300 font-medium mb-1 transition-colors">Bedrooms</span>
                <input
                  type="number"
                  id="bedrooms"
                  onChange={onHandleChanges}
                  value={formData.bedrooms}
                  className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300 font-medium mb-1 transition-colors">Bathrooms</span>
                <input
                  type="number"
                  id="bathrooms"
                  onChange={onHandleChanges}
                  value={formData.bathrooms}
                  className="w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300 font-medium mb-1 transition-colors">Regular Price (₹)</span>
                <input
                  type="number"
                  id="regularPrice"
                  disabled={formData.type === 'rent'}
                  onChange={onHandleChanges}
                  value={formData.type === 'rent' ? formData.monthlyRent : formData.regularPrice}
                  placeholder="Enter price"
                  className={`w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${formData.type === 'rent' ? 'bg-gray-100 dark:bg-gray-950 cursor-not-allowed opacity-75' : ''}`}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300 font-medium mb-1 transition-colors">Discount Price (₹)</span>
                <input
                  type="number"
                  id="discountPrice"
                  disabled={formData.type === 'rent'}
                  onChange={onHandleChanges}
                  value={formData.type === 'rent' ? 0 : formData.discountPrice}
                  placeholder="Enter discount"
                  className={`w-full p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${formData.type === 'rent' ? 'bg-gray-100 dark:bg-gray-950 cursor-not-allowed opacity-75' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Property Features */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Property Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["parking", "furnished", "offer"].map((item) => (
                <label key={item} className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    id={item}
                    onChange={onHandleChanges}
                    checked={formData[item]}
                    className="text-blue-600 dark:accent-blue-500"
                  />
                  <span className="text-gray-700 dark:text-white font-medium capitalize transition-colors">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Property Images */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Property Images</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 transition-colors">
              Upload images directly or add image URLs. Supported formats: JPG, PNG, GIF, WebP, SVG (max 10MB each)
            </p>

            {/* AI Status Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
              <div className="flex items-center gap-2">
                <FaBrain className={`text-blue-600 dark:text-blue-400 ${Object.values(isAuditing).some(v => v) ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  {Object.values(isAuditing).some(v => v) ? 'AI Auditor: Working...' : 'AI Auditor: Ready'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {/* Sync to 360 Checkbox */}
                <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${(!formData.isVerified || formData.imageUrls.filter(url => url).length === 0) ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed' : 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-800 cursor-pointer shadow-sm hover:border-indigo-300'} transition-all`}>
                  <input
                    type="checkbox"
                    checked={syncImagesTo360}
                    disabled={!formData.isVerified || formData.imageUrls.filter(url => url).length === 0}
                    onChange={(e) => {
                      setSyncImagesTo360(e.target.checked);
                      if (e.target.checked && formData.isVerified) {
                        setFormData(prev => {
                          const current360 = [...(prev.virtualTourImages || [])];
                          const newImages = prev.imageUrls.filter(url => url && !current360.includes(url));
                          return {
                            ...prev,
                            virtualTourImages: [...current360, ...newImages]
                          };
                        });
                        toast.success("Images synced to 360° View section!");
                      }
                    }}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer"
                  />
                  <span className={`text-xs font-bold uppercase tracking-wider ${(!formData.isVerified || formData.imageUrls.filter(url => url).length === 0) ? 'text-gray-500 dark:text-gray-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    Sync to 360° {!formData.isVerified ? "(Verified Only)" : (formData.imageUrls.filter(url => url).length === 0 && "(Add Images First)")}
                  </span>
                </label>

                <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-blue-100 dark:border-blue-700 shadow-sm">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    Powered by Sentinel v2.0 Image analyzer
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {formData.imageUrls.map((url, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <input
                      type="text"
                      placeholder={`Image URL ${index + 1} (e.g., https://example.com/image.jpg)`}
                      value={url || ""}
                      onChange={(e) => handleImageChange(index, e.target.value)}
                      className={`w-full md:flex-1 p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${imageErrors[index] ? 'border-red-500' : ''
                        }`}
                    />
                    <input
                      type="text"
                      placeholder="Image Name/Title (e.g. Master Bedroom)"
                      value={formData.imageCaptions?.[index] || ""}
                      onChange={(e) => handleCaptionChange(index, e.target.value)}
                      className="w-full md:flex-1 p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    />
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <label className="flex-1 md:flex-none justify-center bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition cursor-pointer flex items-center">
                        {uploadingImages[index] ? 'Uploading...' : 'Upload File'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(index, e.target.files[0])}
                          className="hidden"
                          disabled={uploadingImages[index]}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!url) {
                            toast.info("Please add an Image URL first to audit.");
                            return;
                          }
                          auditByUrl(url, index, 'main');
                        }}
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                        title="AI Audit this URL"
                        disabled={isAuditing[`main_${index}`]}
                      >
                        <FaBrain className={isAuditing[`main_${index}`] ? 'animate-spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onHandleRemoveImage(index)}
                        className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition flex items-center justify-center"
                        title="Remove this photo"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {imageErrors[index] && (
                    <p className="text-red-500 text-sm">{imageErrors[index]}</p>
                  )}
                  {uploadingImages[index] && (
                    <p className="text-blue-500 text-sm">⏳ Uploading image...</p>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, imageUrls: [...formData.imageUrls, ""] })}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition mt-2"
              >
                Add Photo
              </button>
            </div>

            {/* Image Preview */}
            {formData.imageUrls.some(url => url) && (
              <div className="mt-4">
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">Image Preview:</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {formData.imageUrls.map((url, index) => (
                    url && (
                      <div key={index} className="flex flex-col bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="relative group">
                          <img
                            src={url}
                            alt={`Listing ${index + 1}`}
                            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                            onClick={() => openPreview(index, formData.imageUrls)}
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/400x300?text=Image+Not+Found";
                              e.target.className = "w-full h-48 object-cover rounded-lg opacity-50";
                            }}
                          />
                          <button
                            onClick={() => onHandleRemoveImage(index)}
                            type="button"
                            className="absolute top-2 right-2 bg-red-500/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full hover:bg-red-600 transition z-10"
                          >
                            ×
                          </button>

                          {/* AI status badge */}
                          {auditResults[`main_${index}`] && (
                            <div className="absolute bottom-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                              <FaBrain className="animate-pulse" size={10} />
                              AI AUDITED
                            </div>
                          )}
                        </div>

                        {/* AI Audit Detailed Results */}
                        {auditResults[`main_${index}`] && (
                          <div className="p-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-700 pb-2">
                              <span className="text-gray-500 font-medium">Auto-Detection:</span>
                              <div className="flex gap-1 flex-wrap justify-end">
                                {auditResults[`main_${index}`].suggestions.length > 0 ? (
                                  auditResults[`main_${index}`].suggestions.map(tag => (
                                    <span key={tag} className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-gray-400 italic">Unidentified</span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                                {auditResults[`main_${index}`].quality.brightness === 'Good' ? (
                                  <FaCheckCircle className="text-green-500" />
                                ) : (
                                  <FaExclamationTriangle className="text-amber-500" />
                                )}
                                <span className="text-gray-600 dark:text-gray-400">Light: {auditResults[`main_${index}`].quality.brightness}</span>
                              </div>
                              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                                {auditResults[`main_${index}`].quality.contrast === 'Good' ? (
                                  <FaCheckCircle className="text-green-500" />
                                ) : (
                                  <FaExclamationTriangle className="text-amber-500" />
                                )}
                                <span className="text-gray-600 dark:text-gray-400">Contrast: {auditResults[`main_${index}`].quality.contrast}</span>
                              </div>
                            </div>

                            {auditResults[`main_${index}`].suggestions.length > 0 && (
                              <div className="flex items-start gap-1.5 mt-1 bg-amber-50 dark:bg-amber-900/20 p-1.5 rounded-lg text-amber-800 dark:text-amber-300">
                                <FaLightbulb className="flex-shrink-0 mt-0.5" />
                                <p className="leading-tight">AI thinks this is a <strong>{auditResults[`main_${index}`].suggestions[0]}</strong>. Consider mentioning this in description!</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Property Videos */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg transition-colors">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Property Videos</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 transition-colors">
              Upload videos directly or add video URLs. Supported formats: MP4, WebM, OGG, MOV, MKV (max 100MB each)
            </p>
            <div className="space-y-3">
              {formData.videoUrls.map((url, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder={`Video URL ${index + 1} (e.g., https://example.com/video.mp4)`}
                      value={url || ""}
                      onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                      className={`flex-1 p-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${videoErrors[index] ? 'border-red-500' : ''
                        }`}
                    />
                    <label className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition cursor-pointer">
                      {uploadingVideos[index] ? 'Uploading...' : 'Upload File'}
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleVideoUpload(index, e.target.files[0])}
                        className="hidden"
                        disabled={uploadingVideos[index]}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onHandleRemoveVideo(index)}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition"
                      title="Remove this video"
                    >
                      ×
                    </button>
                  </div>
                  {videoErrors[index] && (
                    <p className="text-red-500 text-sm">{videoErrors[index]}</p>
                  )}
                  {uploadingVideos[index] && (
                    <p className="text-blue-500 text-sm">⏳ Uploading video...</p>
                  )}
                  {url && (
                    <div className="w-full rounded-lg overflow-hidden bg-black">
                      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                        <div className="absolute inset-0 w-full h-full bg-black cursor-pointer group" onClick={() => setPreviewVideo(url)}>
                          <video
                            src={url}
                            className="w-full h-full object-contain"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FaPlay className="text-white text-xl ml-1" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, videoUrls: [...formData.videoUrls, ""] })}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition mt-2"
              >
                Add Video
              </button>
            </div>
          </div>

          {/* 360° Virtual Tour Images (New) - DISABLED for new listings */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 relative transition-colors">
            {/* Overlay Message */}
            <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/80 z-10 flex items-center justify-center rounded-lg backdrop-blur-[2px] transition-colors">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl border border-indigo-100 dark:border-indigo-900/30 max-w-md text-center transform hover:scale-105 transition-all duration-300">
                <div className="bg-gradient-to-br from-indigo-100 to-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <FaCompass className="text-indigo-600 dark:text-indigo-400 text-2xl" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-2">Premium Feature Locked 🔒</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                  360° virtual tours are a <span className="font-semibold text-indigo-600 dark:text-indigo-400">premium feature</span> available exclusively for verified properties.
                </p>
                <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/30 py-3 px-4 rounded-lg border border-indigo-100 dark:border-indigo-800 transition-colors">
                  ✨ Get your property verified after creation to unlock this immersive feature!
                </div>
              </div>
            </div>

            {/* Disabled UI underneath (Visual Placeholder) */}
            <div className="opacity-40 pointer-events-none filter blur-[1px] select-none">
              <div className="flex items-center gap-2 mb-3">
                <FaCompass className="text-gray-500 dark:text-gray-600 text-xl" />
                <h4 className="font-semibold text-gray-500 dark:text-gray-600">360° Virtual Tours</h4>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                Upload equirectangular panoramic images for an immersive 360° view. Supported formats: JPG, PNG.
              </p>
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <input type="text" disabled className="w-full md:flex-1 p-3 border dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600" placeholder="360 Image URL 1" />
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="flex-1 md:flex-none justify-center bg-gray-300 dark:bg-gray-700 text-white dark:text-gray-500 px-3 py-2 rounded-lg flex items-center gap-2">
                      Upload 360°
                    </span>
                    <span className="bg-gray-300 dark:bg-gray-700 text-white dark:text-gray-500 px-3 py-2 rounded-lg flex items-center justify-center">×</span>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <input type="text" disabled className="w-full md:flex-1 p-3 border dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600" placeholder="360 Image URL 2" />
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="flex-1 md:flex-none justify-center bg-gray-300 dark:bg-gray-700 text-white dark:text-gray-500 px-3 py-2 rounded-lg flex items-center gap-2">
                      Upload 360°
                    </span>
                    <span className="bg-gray-300 dark:bg-gray-700 text-white dark:text-gray-500 px-3 py-2 rounded-lg flex items-center justify-center">×</span>
                  </div>
                </div>
                <span className="bg-gray-300 dark:bg-gray-700 text-white dark:text-gray-500 px-4 py-2 rounded-lg inline-flex items-center gap-2 mt-2">
                  <FaCompass /> Add 360° Image
                </span>
              </div>
            </div>
          </div>

          {/* ESG Management Section */}
          <div className="mb-6">
            <ESGManagement
              esgData={formData.esg}
              onESGChange={(esgData) => setFormData({ ...formData, esg: esgData })}
              isEditing={false}
            />
          </div>

          {/* Consent Checkbox for Users */}
          {currentUser.role !== 'admin' && currentUser.role !== 'rootadmin' && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="accent-blue-600 dark:accent-blue-500 w-4 h-4 cursor-pointer"
                required
              />
              <label htmlFor="consent" className="text-sm text-gray-700 dark:text-gray-300 select-none cursor-pointer transition-colors">
                I confirm that <span className="font-semibold text-blue-700 dark:text-blue-400">all the information provided in this listing is true and genuine to the best of my knowledge</span>. Providing false information may result in account suspension or legal action.
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate(getPreviousPath())}
              disabled={loading}
              className="flex-1 bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 transition-all transform hover:scale-105 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Listing"}
            </button>
          </div>
          {error && <p className="text-red-500 text-center">{error}</p>}
          <VideoPreview
            isOpen={!!previewVideo}
            onClose={() => setPreviewVideo(null)}
            videos={previewVideo ? [previewVideo] : []}
          />
        </form>
      </div>
      <ImagePreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        images={previewImages}
        initialIndex={previewIndex}
      />
    </div>
  );
}
