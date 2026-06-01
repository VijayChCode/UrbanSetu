import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaUpload, FaTimes, FaImage, FaVideo, FaFile, FaPaperclip, FaDownload } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';
import ImagePreview from '../ImagePreview';
import VideoPreview from '../VideoPreview';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { authenticatedFetch } from '../../utils/auth';

const DISPUTE_CATEGORIES = [
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'property_maintenance', label: 'Property Maintenance' },
  { value: 'behavior', label: 'Behavior' },
  { value: 'contract_violation', label: 'Contract Violation' },
  { value: 'damage_assessment', label: 'Damage Assessment' },
  { value: 'early_termination', label: 'Early Termination' },
  { value: 'other', label: 'Other' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium', default: true },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

export default function DisputeForm({ contract, onSuccess, onCancel }) {
  const { currentUser } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [formData, setFormData] = useState({
    contractId: contract?._id || '',
    category: 'other',
    title: '',
    description: '',
    priority: 'medium',
    evidence: []
  });

  useEffect(() => {
    if (!contract) {
      fetchContracts();
    } else {
      setFormData(prev => ({ ...prev, contractId: contract._id }));
    }
  }, [contract]);

  const fetchContracts = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts?status=active`);
      const data = await res.json();
      if (res.ok && data.success) {
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDownloadDocument = async (docUrl, docName) => {
    try {
      if (!docUrl) return;

      const response = await authenticatedFetch(docUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch document');

      const contentType = response.headers.get('content-type') || '';
      let extension = 'pdf';

      try {
        const urlPath = docUrl.split('?')[0];
        const lastSegment = urlPath.substring(urlPath.lastIndexOf('/') + 1);
        if (lastSegment.includes('.')) {
          extension = lastSegment.split('.').pop();
        }
      } catch (e) {
        console.warn('URL parsing failed', e);
      }

      if ((!extension || extension === 'file') && contentType && !contentType.includes('octet-stream')) {
        const mimeMap = {
          'application/pdf': 'pdf',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
          'text/plain': 'txt'
        };
        extension = mimeMap[contentType.toLowerCase()] || 'pdf';
      }

      const filename = `${docName || 'document'}-${new Date().getTime()}.${extension}`;
      const blob = await response.blob();

      const finalBlob = extension === 'pdf' && contentType.includes('octet-stream')
        ? new Blob([blob], { type: 'application/pdf' })
        : blob;

      const blobUrl = window.URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error('Error downloading document:', error);
      window.open(docUrl, '_blank');
    }
  };

  const handleEvidenceUpload = async (e, type) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(type);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        let endpoint = '/api/upload/image';

        if (type === 'image') {
          formData.append('image', file);
        } else if (type === 'video') {
          formData.append('video', file);
          endpoint = '/api/upload/video';
        } else {
          formData.append('document', file);
          endpoint = '/api/upload/document';
        }

        const res = await authenticatedFetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) throw new Error('Upload failed');

        const data = await res.json();
        return {
          type,
          url: data.imageUrl || data.videoUrl || data.documentUrl || data.url,
          description: '',
          uploadedAt: new Date(),
          uploadedBy: currentUser._id
        };
      });

      const uploaded = await Promise.all(uploadPromises);
      setFormData(prev => ({
        ...prev,
        evidence: [...prev.evidence, ...uploaded]
      }));
      toast.success(`${uploaded.length} file(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload files');
      console.error(error);
    } finally {
      setUploading(null);
    }
  };

  const removeEvidence = (index) => {
    setFormData(prev => ({
      ...prev,
      evidence: prev.evidence.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.contractId) {
      toast.error('Please select a contract');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Please enter a dispute title');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Please enter a dispute description');
      return;
    }

    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/disputes/${formData.contractId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formData.category,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          evidence: formData.evidence
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Dispute created successfully');
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.message || 'Failed to create dispute');
      }
    } catch (error) {
      console.error('Error creating dispute:', error);
      toast.error('Failed to create dispute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contract Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Rental Contract <span className="text-red-500">*</span>
        </label>
        {contract ? (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg">
            <div className="font-semibold dark:text-white">{contract.listingId?.name || 'Property'}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Contract ID: {contract.contractId}</div>
          </div>
        ) : (
          <select
            name="contractId"
            value={formData.contractId}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Select a contract</option>
            {contracts.map(c => (
              <option key={c._id} value={c._id}>
                {c.listingId?.name || 'Property'} - {c.contractId}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          name="category"
          value={formData.category}
          onChange={handleInputChange}
          required
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {DISPUTE_CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Priority
        </label>
        <select
          name="priority"
          value={formData.priority}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {PRIORITY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          required
          placeholder="Brief description of the dispute"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          required
          rows={6}
          placeholder="Provide detailed information about the dispute..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {/* Evidence Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Evidence (Optional)
        </label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading === 'image' ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaImage className="text-blue-700 dark:text-blue-300" />}
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Upload Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleEvidenceUpload(e, 'image')}
              disabled={!!uploading}
            />
          </label>
          <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading === 'video' ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaVideo className="text-purple-700 dark:text-purple-300" />}
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Upload Videos</span>
            <input
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => handleEvidenceUpload(e, 'video')}
              disabled={!!uploading}
            />
          </label>
          <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading === 'document' ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaFile className="text-green-700 dark:text-green-300" />}
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Upload Documents</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={(e) => handleEvidenceUpload(e, 'document')}
              disabled={!!uploading}
            />
          </label>
        </div>

        {/* Evidence Preview */}
        {formData.evidence.length > 0 && (
          <div className="space-y-2">
            {formData.evidence.map((evidence, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex-1">
                  {evidence.type === 'image' && (
                    <div className="w-20 h-20 rounded overflow-hidden bg-gray-200 dark:bg-gray-600">
                      <img
                        src={evidence.url}
                        alt="Evidence preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {evidence.type === 'video' && (
                    <div className="w-20 h-20 rounded overflow-hidden bg-gray-200 dark:bg-gray-600">
                      <video
                        src={evidence.url}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {evidence.type === 'document' && (
                    <div className="flex items-center gap-2">
                      <FaFile className="text-blue-600 dark:text-blue-400" />
                      <div className="flex flex-col">
                        <Link
                          to={evidence._id ? `/user/view/${evidence._id}?source=disputes` : `/user/view/preview?url=${encodeURIComponent(evidence.url)}&type=document&name=${evidence.name || 'DisputeEvidence'}&source=disputes`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium text-left"
                        >
                          {evidence.name || 'Document'}
                        </Link>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDownloadDocument(evidence.url, 'evidence');
                          }}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 hover:underline text-left"
                        >
                          <FaDownload className="text-[10px]" /> Download
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeEvidence(index)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <FaTimes />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaPaperclip />}
          {loading ? 'Creating...' : 'Raise Dispute'}
        </button>
      </div>
    </form>
  );
}

