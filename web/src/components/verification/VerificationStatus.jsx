import React, { useState } from 'react';
import { FaCheckCircle, FaTimesCircle, FaClock, FaShieldAlt, FaFileAlt, FaMapMarkerAlt, FaImage, FaHome, FaTimes, FaDownload } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';
import { toast } from 'react-toastify';
import ImagePreview from '../ImagePreview';
import { authenticatedFetch } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function VerificationStatus({ verification, listing, currentUser, onUpdate, STATUS_COLORS, STATUS_LABELS, onClose, isAdminView = false }) {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'rootadmin';
  const isVerified = verification.status === 'verified';
  const isRejected = verification.status === 'rejected';
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const getDocumentStatus = (doc) => {
    if (doc.verified) {
      return { icon: <FaCheckCircle className="text-green-600" />, text: 'Verified', color: 'text-green-700' };
    }
    return { icon: <FaClock className="text-yellow-600" />, text: 'Pending', color: 'text-yellow-700' };
  };

  const handleApprove = async () => {
    if (!isAdmin) {
      toast.error('Unauthorized. Only admin can approve verification.');
      return;
    }

    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/verification/${verification._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownershipVerified: true,
          identityVerified: true,
          addressVerified: true,
          photosVerified: true,
          locationVerified: true,
          amenitiesVerified: true,
          adminNotes: adminNotes || 'All documents and property details verified successfully.'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Verification approved successfully!');
        if (onUpdate) onUpdate();
        if (onClose) onClose();
      } else {
        toast.error(data.message || 'Failed to approve verification');
      }
    } catch (error) {
      console.error('Error approving verification:', error);
      toast.error('Failed to approve verification');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!isAdmin) {
      toast.error('Unauthorized. Only admin can reject verification.');
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/verification/${verification._id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectionReason: rejectionReason,
          adminNotes: adminNotes || ''
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Verification rejected.');
        setShowRejectModal(false);
        setRejectionReason('');
        setAdminNotes('');
        if (onUpdate) onUpdate();
        if (onClose) onClose();
      } else {
        toast.error(data.message || 'Failed to reject verification');
      }
    } catch (error) {
      console.error('Error rejecting verification:', error);
      toast.error('Failed to reject verification');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (docUrl, docType, docName) => {
    try {
      if (!docUrl) return;

      // Clean URL for fetching
      const fetchUrl = docUrl;

      // Fetch the document
      const response = await authenticatedFetch(fetchUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch document');

      const contentType = response.headers.get('content-type') || '';

      // Determine file extension
      let extension = 'pdf'; // Default to PDF as it's the most common document type

      // 1. Try to get extension from URL first as it's often most reliable for Cloudinary
      try {
        const urlPath = docUrl.split('?')[0];
        const lastSegment = urlPath.substring(urlPath.lastIndexOf('/') + 1);
        if (lastSegment.includes('.')) {
          extension = lastSegment.split('.').pop();
        }
      } catch (e) {
        console.warn('URL parsing failed', e);
      }

      // 2. If URL didn't have extension, check metadata docType
      if (extension === 'file' || extension === 'pdf') { // if default or generic
        if (docType && docType.toLowerCase() !== 'document') {
          // e.g., 'image/png' map to png, or simple 'PDF' map to pdf
          if (docType.toLowerCase().includes('pdf')) extension = 'pdf';
          else if (docType.toLowerCase().includes('image')) extension = 'jpg';
        }
      }

      // 3. Last fallback: Check content-type if we still don't have a good extension
      // But ignore octet-stream as it's useless for typing
      if (!extension && contentType && !contentType.includes('octet-stream')) {
        const mimeMap = {
          'application/pdf': 'pdf',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
          'text/plain': 'txt'
        };
        extension = mimeMap[contentType.toLowerCase()] || extension;
      }

      // Ensure we have a valid extension
      if (!extension || extension === 'file') extension = 'pdf';

      const filename = `${docName || 'document'}-${verification.verificationId}.${extension}`;

      // Create Blob
      const blob = await response.blob();

      // Force correct MIME type if we know it's a PDF but served as octet-stream
      const finalBlob = extension === 'pdf' && contentType.includes('octet-stream')
        ? new Blob([blob], { type: 'application/pdf' })
        : blob;

      const blobUrl = window.URL.createObjectURL(finalBlob);

      // Trigger Download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error('Error downloading document:', error);
      // Fallback: Open in new tab
      window.open(docUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FaShieldAlt className="text-blue-600 dark:text-blue-400" />
          Verification Status
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Property Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-100 mb-1">{listing.name}</h3>
        <p className="text-sm text-blue-700 dark:text-blue-200">{listing.address}</p>
        <div className="mt-2 text-xs text-blue-600 dark:text-blue-300">
          Verification ID: <span className="font-mono">{verification.verificationId}</span>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`p-4 rounded-lg border-2 ${STATUS_COLORS[verification.status] || STATUS_COLORS.pending}`}>
        <div className="flex items-center gap-3">
          {isVerified && <FaCheckCircle className="text-2xl" />}
          {isRejected && <FaTimesCircle className="text-2xl" />}
          {!isVerified && !isRejected && <FaClock className="text-2xl" />}
          <div>
            <div className="font-bold text-lg">Status: {STATUS_LABELS[verification.status] || verification.status}</div>
            {verification.badgeNumber && (
              <div className="text-sm mt-1">
                Badge Number: <span className="font-mono font-semibold">{verification.badgeNumber}</span>
              </div>
            )}
            {verification.badgeExpiry && (
              <div className="text-sm mt-1">
                Expires: {new Date(verification.badgeExpiry).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documents Verification */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <FaFileAlt /> Document Verification
        </h3>
        <div className="space-y-3">
          {/* Ownership Proof */}
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FaFileAlt className="text-blue-600 dark:text-blue-400" />
                <span className="font-medium dark:text-gray-200">Ownership Proof</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">({verification.documents.ownershipProof.documentType})</span>
              </div>
              <div className={`flex items-center gap-1 ${getDocumentStatus(verification.documents.ownershipProof).color}`}>
                {getDocumentStatus(verification.documents.ownershipProof).icon}
                <span className="text-sm font-medium">{getDocumentStatus(verification.documents.ownershipProof).text}</span>
              </div>
            </div>
            {verification.documents.ownershipProof.documentUrl && (
              <div className="mt-2">
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const basePath = isAdmin ? '/admin' : '/user';
                      const doc = verification.documents.ownershipProof;
                      if (doc._id) {
                        window.open(`${basePath}/view/${doc._id}?source=verification`, '_blank');
                      } else {
                        const encodedUrl = encodeURIComponent(doc.documentUrl);
                        window.open(`${basePath}/view/preview?url=${encodedUrl}&type=document&name=OwnershipProof&source=verification`, '_blank');
                      }
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <FaFileAlt /> View
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDownloadDocument(
                        verification.documents.ownershipProof.documentUrl,
                        verification.documents.ownershipProof.documentType,
                        'ownership-proof'
                      );
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    title="Download Document"
                  >
                    <FaDownload />
                  </button>
                </div>
              </div>
            )}
            {verification.documents.ownershipProof.verifiedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Verified on: {new Date(verification.documents.ownershipProof.verifiedAt).toLocaleString()}
              </div>
            )}
            {verification.documents.ownershipProof.rejectionReason && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                Reason: {verification.documents.ownershipProof.rejectionReason}
              </div>
            )}
          </div>

          {/* Identity Proof */}
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FaFileAlt className="text-green-600 dark:text-green-400" />
                <span className="font-medium dark:text-gray-200">Identity Proof</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">({verification.documents.identityProof.documentType})</span>
              </div>
              <div className={`flex items-center gap-1 ${getDocumentStatus(verification.documents.identityProof).color}`}>
                {getDocumentStatus(verification.documents.identityProof).icon}
                <span className="text-sm font-medium">{getDocumentStatus(verification.documents.identityProof).text}</span>
              </div>
            </div>
            {verification.documents.identityProof.documentUrl && (
              <div className="mt-2">
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const basePath = isAdmin ? '/admin' : '/user';
                      const doc = verification.documents.identityProof;
                      if (doc._id) {
                        window.open(`${basePath}/view/${doc._id}?source=verification`, '_blank');
                      } else {
                        const encodedUrl = encodeURIComponent(doc.documentUrl);
                        window.open(`${basePath}/view/preview?url=${encodedUrl}&type=document&name=IdentityProof&source=verification`, '_blank');
                      }
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <FaFileAlt /> View
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDownloadDocument(
                        verification.documents.identityProof.documentUrl,
                        verification.documents.identityProof.documentType,
                        'identity-proof'
                      );
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    title="Download Document"
                  >
                    <FaDownload />
                  </button>
                </div>
              </div>
            )}
            {verification.documents.identityProof.verifiedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Verified on: {new Date(verification.documents.identityProof.verifiedAt).toLocaleString()}
              </div>
            )}
            {verification.documents.identityProof.rejectionReason && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                Reason: {verification.documents.identityProof.rejectionReason}
              </div>
            )}
          </div>

          {/* Address Proof */}
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FaFileAlt className="text-purple-600 dark:text-purple-400" />
                <span className="font-medium dark:text-gray-200">Address Proof</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">({verification.documents.addressProof.documentType})</span>
              </div>
              <div className={`flex items-center gap-1 ${getDocumentStatus(verification.documents.addressProof).color}`}>
                {getDocumentStatus(verification.documents.addressProof).icon}
                <span className="text-sm font-medium">{getDocumentStatus(verification.documents.addressProof).text}</span>
              </div>
            </div>
            {verification.documents.addressProof.documentUrl && (
              <div className="mt-2">
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const basePath = isAdmin ? '/admin' : '/user';
                      const doc = verification.documents.addressProof;
                      if (doc._id) {
                        window.open(`${basePath}/view/${doc._id}?source=verification`, '_blank');
                      } else {
                        const encodedUrl = encodeURIComponent(doc.documentUrl);
                        window.open(`${basePath}/view/preview?url=${encodedUrl}&type=document&name=AddressProof&source=verification`, '_blank');
                      }
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <FaFileAlt /> View
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDownloadDocument(
                        verification.documents.addressProof.documentUrl,
                        verification.documents.addressProof.documentType,
                        'address-proof'
                      );
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    title="Download Document"
                  >
                    <FaDownload />
                  </button>
                </div>
              </div>
            )}
            {verification.documents.addressProof.verifiedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Verified on: {new Date(verification.documents.addressProof.verifiedAt).toLocaleString()}
              </div>
            )}
            {verification.documents.addressProof.rejectionReason && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                Reason: {verification.documents.addressProof.rejectionReason}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Property Inspection */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <FaHome /> Property Inspection
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium dark:text-gray-200">Photos Verified</span>
              {verification.photosVerified ? (
                <FaCheckCircle className="text-green-600 dark:text-green-400" />
              ) : (
                <FaClock className="text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium dark:text-gray-200">Location Verified</span>
              {verification.locationVerified ? (
                <FaCheckCircle className="text-green-600 dark:text-green-400" />
              ) : (
                <FaClock className="text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium dark:text-gray-200">Amenities Verified</span>
              {verification.amenitiesVerified ? (
                <FaCheckCircle className="text-green-600 dark:text-green-400" />
              ) : (
                <FaClock className="text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Reason */}
      {isRejected && verification.rejectionReason && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Rejection Reason</h4>
          <p className="text-sm text-red-700 dark:text-red-300">{verification.rejectionReason}</p>
          {verification.rejectedAt && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-2">
              Rejected on: {new Date(verification.rejectedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Admin Notes */}
      {verification.adminNotes && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Admin Notes</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">{verification.adminNotes}</p>
        </div>
      )}

      {/* Admin Actions */}
      {isAdmin && isAdminView && !isVerified && !isRejected && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Admin Actions</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Admin Notes (Optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this verification..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                {loading ? (
                  <>
                    <UrbanSetuSpinner size="sm" isBright={true} />
                    Processing...
                  </>
                ) : (
                  <>
                    <FaCheckCircle /> Approve Verification
                  </>
                )}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                <FaTimesCircle /> Reject Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-red-700 mb-4 flex items-center gap-2">
              <FaTimesCircle /> Reject Verification
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={4}
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectionReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
                >
                  {loading ? (
                    <>
                      <UrbanSetuSpinner size="sm" isBright={true} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaTimesCircle /> Confirm Rejection
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>Created: {new Date(verification.createdAt).toLocaleString()}</div>
        <div>Last Updated: {new Date(verification.updatedAt).toLocaleString()}</div>
      </div>
    </div>
  );
}

