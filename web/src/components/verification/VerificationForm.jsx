import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaUpload, FaTimes, FaFile, FaCheckCircle } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';
import ImagePreview from '../ImagePreview';
import { authenticatedFetch } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const OWNERSHIP_TYPES = [
  { value: 'sale_deed', label: 'Sale Deed' },
  { value: 'gift_deed', label: 'Gift Deed' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'lease', label: 'Lease Agreement' },
  { value: 'other', label: 'Other' }
];

const IDENTITY_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'other', label: 'Other' }
];

const ADDRESS_TYPES = [
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'rent_agreement', label: 'Rent Agreement' },
  { value: 'other', label: 'Other' }
];

export default function VerificationForm({ listing, onSuccess, onCancel }) {
  const { currentUser } = useSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({});
  const [formData, setFormData] = useState({
    ownershipProof: {
      documentUrl: '',
      documentType: 'sale_deed'
    },
    identityProof: {
      documentUrl: '',
      documentType: 'aadhaar'
    },
    addressProof: {
      documentUrl: '',
      documentType: 'utility_bill'
    },
    verificationFee: 0
  });

  const handleInputChange = (e, section) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [name]: value
      }
    }));
  };

  const handleDocumentUpload = async (e, section) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [section]: true }));

    try {
      const formDataObj = new FormData();
      formDataObj.append('document', file);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/document`, {
        method: 'POST',
        body: formDataObj
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      // Cloudinary returns 'path' for document URL
      const documentUrl = data.documentUrl || data.path || data.url || data.imageUrl;
      const originalName = data.originalName || 'Document';

      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          documentUrl,
          originalName
        }
      }));

      toast.success('Document uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload document');
      console.error(error);
    } finally {
      setUploading(prev => ({ ...prev, [section]: false }));
    }
  };

  const removeDocument = (section) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        documentUrl: ''
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required documents
    if (!formData.ownershipProof.documentUrl) {
      toast.error('Please upload ownership proof document');
      return;
    }

    if (!formData.identityProof.documentUrl) {
      toast.error('Please upload identity proof document');
      return;
    }

    if (!formData.addressProof.documentUrl) {
      toast.error('Please upload address proof document');
      return;
    }

    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/verification/${listing._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownershipProof: formData.ownershipProof,
          identityProof: formData.identityProof,
          addressProof: formData.addressProof,
          verificationFee: formData.verificationFee
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Verification request submitted successfully');
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.message || 'Failed to submit verification request');
      }
    } catch (error) {
      console.error('Error submitting verification:', error);
      toast.error('Failed to submit verification request');
    } finally {
      setLoading(false);
    }
  };

  const renderDocumentSection = (title, section, documentTypes, placeholder) => {
    const hasDocument = formData[section].documentUrl;
    const isUploading = uploading[section];

    return (
      <div className="border dark:border-gray-700 rounded-lg p-4 space-y-3">
        <h4 className="font-semibold text-gray-800 dark:text-white">{title} <span className="text-red-500">*</span></h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document Type</label>
          <select
            name="documentType"
            value={formData[section].documentType}
            onChange={(e) => handleInputChange(e, section)}
            className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {documentTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Document</label>
          {!hasDocument ? (
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/10 border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transaction-colors">
              {isUploading ? (
                <UrbanSetuSpinner size="sm" isBright={true} />
              ) : (
                <FaUpload className="text-blue-600 dark:text-blue-400" />
              )}
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {isUploading ? 'Uploading...' : 'Click to upload document'}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => handleDocumentUpload(e, section)}
                disabled={isUploading}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <FaCheckCircle className="text-green-600 dark:text-green-400 shrink-0" />
              <span
                className="flex-1 text-sm text-green-700 dark:text-green-300 font-medium hover:underline cursor-pointer truncate"
                onClick={() => {
                  const encodedUrl = encodeURIComponent(formData[section].documentUrl);
                  const name = formData[section].originalName || 'Document';
                  window.open(`/user/view/preview?url=${encodedUrl}&type=document&name=${name}&source=verification`, '_blank');
                }}
                title="Click to preview"
              >
                {formData[section].originalName || 'Document uploaded'}
              </span>
              <button
                type="button"
                onClick={() => removeDocument(section)}
                className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 text-sm"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Request Property Verification</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
        >
          <FaTimes />
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-100 mb-2">{listing.name}</h3>
        <p className="text-sm text-blue-700 dark:text-blue-200">{listing.address}</p>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Note:</strong> Please upload clear, legible documents. All documents will be verified by our admin team.
          Verification typically takes 2-5 business days.
        </p>
      </div>

      {/* Ownership Proof */}
      {renderDocumentSection(
        'Ownership Proof',
        'ownershipProof',
        OWNERSHIP_TYPES,
        'Upload ownership document (Sale Deed, Gift Deed, etc.)'
      )}

      {/* Identity Proof */}
      {renderDocumentSection(
        'Identity Proof',
        'identityProof',
        IDENTITY_TYPES,
        'Upload identity document (Aadhaar, PAN, Passport, etc.)'
      )}

      {/* Address Proof */}
      {renderDocumentSection(
        'Address Proof',
        'addressProof',
        ADDRESS_TYPES,
        'Upload address proof (Utility Bill, Bank Statement, etc.)'
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaCheckCircle />}
          {loading ? 'Submitting...' : 'Submit Verification Request'}
        </button>
      </div>
    </form>
  );
}

