import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaUser, FaClock, FaFileAlt, FaComments, FaCheckCircle, FaTimes, FaPaperPlane, FaUpload, FaImage, FaVideo, FaFile, FaDownload, FaGavel, FaExclamationTriangle, FaEdit, FaSync } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';
import ImagePreview from '../ImagePreview';
import VideoPreview from '../VideoPreview';
import UserAvatar from '../UserAvatar';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { authenticatedFetch } from '../../utils/auth';

export default function DisputeDetail({
  dispute,
  currentUser,
  onUpdate,
  getStatusColor,
  DISPUTE_CATEGORIES,
  DISPUTE_STATUS,
  PRIORITY_COLORS,
  isAdmin: propIsAdmin,
  onUpdateStatus,
  onResolve,
  updatingStatus,
  resolving
}) {
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState({ image: false, video: false, document: false });
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: dispute.status || 'open',
    priority: dispute.priority || 'medium',
    escalationReason: ''
  });
  const [resolveForm, setResolveForm] = useState({
    resolution: '',
    resolutionNotes: ''
  });

  // Media Preview States
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [republishing, setRepublishing] = useState(false);

  const handleRepublish = async () => {
    if (!window.confirm('Are you sure you want to republish this property? This will mark it as available.')) return;

    try {
      setRepublishing(true);
      const listingId = dispute.bookingId?.listingId?._id;
      if (!listingId) {
        toast.error("Listing ID not found");
        return;
      }

      const res = await authenticatedFetch(`${API_BASE_URL}/api/listing/republish/${listingId}`, {
        method: 'POST',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Property republished successfully!');
        if (onUpdate) onUpdate();
      } else {
        toast.error(data.message || 'Failed to republish property');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error republishing property');
    } finally {
      setRepublishing(false);
    }
  };

  const isAdmin = propIsAdmin || currentUser?.role === 'admin' || currentUser?.role === 'rootadmin';
  const isRaisedBy = dispute.raisedBy?._id === currentUser?._id || dispute.raisedBy === currentUser?._id;
  const isRaisedAgainst = dispute.raisedAgainst?._id === currentUser?._id || dispute.raisedAgainst === currentUser?._id;
  const canComment = isRaisedBy || isRaisedAgainst || isAdmin;

  const handleSendMessage = async () => {
    if (!newMessage.trim() && attachments.length === 0) {
      toast.error('Please enter a message or attach files');
      return;
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      toast.error('Cannot send messages in a resolved or closed dispute you can use myappointments page chatbox to chat');
      return;
    }

    try {
      setSending(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/disputes/${dispute._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage,
          attachments: attachments.map(a => a.url)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Message sent');
        setNewMessage('');
        setAttachments([]);
        if (onUpdate) onUpdate();
      } else {
        toast.error(data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadDocument = async (docUrl, docName) => {
    try {
      if (!docUrl) return;

      // Clean URL for fetching
      const fetchUrl = docUrl;

      // Fetch the document
      const response = await authenticatedFetch(fetchUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch document');

      const contentType = response.headers.get('content-type') || '';

      // Determine file extension
      let extension = 'pdf'; // Default to PDF 

      // 1. Try to get extension from URL 
      try {
        const urlPath = docUrl.split('?')[0];
        const lastSegment = urlPath.substring(urlPath.lastIndexOf('/') + 1);
        if (lastSegment.includes('.')) {
          extension = lastSegment.split('.').pop();
        }
      } catch (e) {
        console.warn('URL parsing failed', e);
      }

      // 2. Check content-type if explicit and not octet-stream
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

      const filename = `${docName || 'evidence'}-${dispute.disputeId}.${extension}`;

      // Create Blob
      const blob = await response.blob();

      // Force correct MIME type if we assume PDF but served as octet-stream
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

  const handleAttachmentUpload = async (e, type) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(prev => ({ ...prev, [type]: true }));
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
          url: data.imageUrl || data.videoUrl || data.documentUrl || data.url
        };
      });

      const uploaded = await Promise.all(uploadPromises);
      setAttachments([...attachments, ...uploaded]);
      toast.success(`${uploaded.length} file(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload files');
      console.error(error);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const getMediaType = (url) => {
    if (!url) return 'document';
    const extension = url.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov'].includes(extension)) return 'video';
    return 'document';
  };

  const renderMessageAttachment = (url, idx) => {
    const type = getMediaType(url);

    if (type === 'image') {
      return (
        <div
          key={idx}
          className="relative group cursor-pointer aspect-square rounded overflow-hidden border border-gray-200 dark:border-gray-700"
          onClick={() => {
            setSelectedImage(url);
            setShowImagePreview(true);
          }}
        >
          <img src={url} alt="Attachment" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
            <FaImage className="text-white opacity-0 group-hover:opacity-100" />
          </div>
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div
          key={idx}
          className="relative group cursor-pointer aspect-square rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-black"
          onClick={() => {
            setSelectedVideo(url);
            setShowVideoPreview(true);
          }}
        >
          <video src={url} className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 flex items-center justify-center">
            <FaVideo className="text-white text-2xl" />
          </div>
        </div>
      );
    }

    return (
      <div
        key={idx}
        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => {
          const basePath = isAdmin ? '/admin' : '/user';
          const encodedUrl = encodeURIComponent(url);
          window.open(`${basePath}/view/preview?url=${encodedUrl}&type=document&name=Attachment${idx + 1}`, '_blank');
        }}
      >
        <FaFile className="text-blue-500 shrink-0" />
        <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px] flex-1">
          Attachment {idx + 1}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDownloadDocument(url, 'attachment');
          }}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline shrink-0 flex items-center gap-1"
          title="Download"
        >
          <FaDownload className="text-[10px]" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b dark:border-gray-700 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{dispute.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono mb-3">{dispute.disputeId}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${PRIORITY_COLORS[dispute.priority] || PRIORITY_COLORS.medium}`}>
                {dispute.priority?.toUpperCase() || 'MEDIUM'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getStatusColor(dispute.status)}`}>
                {DISPUTE_STATUS[dispute.status] || dispute.status}
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-semibold">
                {DISPUTE_CATEGORIES[dispute.category] || dispute.category}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Raised by:</span>{' '}
            <span className="text-gray-800 dark:text-gray-200">{dispute.raisedBy?.username || 'Unknown'}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Against:</span>{' '}
            <span className="text-gray-800 dark:text-gray-200">{dispute.raisedAgainst?.username || 'Unknown'}</span>
          </div>
          {(dispute.contractId?.listingId?.name || dispute.bookingId?.listingId?.name) && (
            <div>
              <span className="text-gray-600 dark:text-gray-400 font-medium">Property:</span>{' '}
              <span className="text-gray-800 dark:text-gray-200">
                {dispute.contractId?.listingId?.name || dispute.bookingId?.listingId?.name}
              </span>
            </div>
          )}
          <div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Created:</span>{' '}
            <span className="text-gray-800 dark:text-gray-200">{new Date(dispute.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Description</h4>
        <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">{dispute.description}</p>
      </div>

      {/* Evidence */}
      {dispute.evidence && dispute.evidence.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <FaFileAlt /> Evidence ({dispute.evidence.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {dispute.evidence.map((evidence, index) => (
              <div key={index} className="border dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
                {evidence.type === 'image' && (
                  <div
                    className="aspect-square rounded overflow-hidden mb-2 cursor-pointer relative group"
                    onClick={() => {
                      setSelectedImage(evidence.url);
                      setShowImagePreview(true);
                    }}
                  >
                    <img
                      src={evidence.url}
                      alt="Evidence"
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-30 transition-opacity">
                      <FaImage className="text-white text-2xl" />
                    </div>
                  </div>
                )}
                {evidence.type === 'video' && (
                  <div
                    className="aspect-square rounded overflow-hidden mb-2 cursor-pointer relative group"
                    onClick={() => {
                      setSelectedVideo(evidence.url);
                      setShowVideoPreview(true);
                    }}
                  >
                    <video
                      src={evidence.url}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                      <FaVideo className="text-white text-2xl" />
                    </div>
                  </div>
                )}
                {evidence.type === 'document' && (
                  <div
                    className="aspect-square flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/10 rounded mb-2 border border-blue-100 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                    onClick={() => {
                      const basePath = isAdmin ? '/admin' : '/user';
                      if (evidence._id) {
                        window.open(`${basePath}/view/${evidence._id}`, '_blank');
                      } else {
                        const encodedUrl = encodeURIComponent(evidence.url);
                        window.open(`${basePath}/view/preview?url=${encodedUrl}&type=document&name=DisputeEvidence`, '_blank');
                      }
                    }}
                  >
                    <FaFile className="text-4xl text-blue-600 dark:text-blue-400 mb-2" />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownloadDocument(evidence.url, 'document');
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <FaDownload className="text-[10px]" /> Download
                    </button>
                  </div>
                )}
                {evidence.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2" title={evidence.description}>{evidence.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution */}
      {dispute.status === 'resolved' && dispute.resolution && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FaCheckCircle className="text-green-600 dark:text-green-400" />
            <h4 className="font-semibold text-green-800 dark:text-green-200">Resolution</h4>
          </div>
          <div className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
            <div><span className="font-medium text-gray-900 dark:text-white">Decision:</span> {dispute.resolution.decision || 'N/A'}</div>
            <div><span className="font-medium text-gray-900 dark:text-white">Action Taken:</span> {dispute.resolution.actionTaken || 'N/A'}</div>
            {dispute.resolution.amount > 0 && (
              <div><span className="font-medium text-gray-900 dark:text-white">Amount:</span> ₹{dispute.resolution.amount.toLocaleString()}</div>
            )}
            {dispute.resolution.notes && (
              <div><span className="font-medium text-gray-900 dark:text-white">Notes:</span> {dispute.resolution.notes}</div>
            )}
            {dispute.resolution.resolutionDate && (
              <div><span className="font-medium text-gray-900 dark:text-white">Resolved on:</span> {new Date(dispute.resolution.resolutionDate).toLocaleString()}</div>
            )}
            {dispute.resolution.decidedBy && (
              <div><span className="font-medium text-gray-900 dark:text-white">Decided by:</span> {dispute.resolution.decidedBy?.username || 'Admin'}</div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div>
        <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <FaComments /> Messages ({dispute.messages?.length || 0})
        </h4>
        <div className="space-y-4 max-h-96 overflow-y-auto mb-4 p-2">
          {dispute.messages && dispute.messages.length > 0 ? (
            dispute.messages.map((message, index) => {
              const isOwnMessage = message.sender?._id === currentUser?._id || message.sender === currentUser?._id;
              return (
                <div
                  key={index}
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <div className="shrink-0">
                    <UserAvatar
                      user={message.sender}
                      size="md"
                    />
                  </div>
                  <div className={`flex-1 max-w-[80%] ${isOwnMessage ? 'text-right' : ''}`}>
                    <div className={`inline-block p-3 rounded-lg text-left ${isOwnMessage ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}>
                      <div className="font-semibold text-sm mb-1">
                        {(message.sender?.role === 'admin' || message.sender?.role === 'rootadmin')
                          ? 'UrbanSetu Support'
                          : (message.sender?.username || 'Unknown')}
                        {isOwnMessage && ' (You)'}
                      </div>
                      <p className="text-sm border-b border-black/5 dark:border-white/10 pb-2 mb-2 whitespace-pre-wrap">{message.message}</p>

                      {/* Message Attachments Preview */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {message.attachments.map((url, idx) => renderMessageAttachment(url, idx))}
                        </div>
                      )}

                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                        {new Date(message.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No messages yet</p>
          )}
        </div>

        {/* Message Input */}
        {canComment && dispute.status !== 'resolved' && dispute.status !== 'closed' && (
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="mb-3">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            {/* Attachments Preview (Pending Uploads) */}
            {attachments.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Attached Files:</p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="relative w-20 h-20 border rounded overflow-hidden group">
                      {attachment.type === 'image' ? (
                        <img src={attachment.url} className="w-full h-full object-cover" alt="preview" />
                      ) : attachment.type === 'video' ? (
                        <div className="w-full h-full bg-black flex items-center justify-center">
                          <FaVideo className="text-white" />
                        </div>
                      ) : (
                        <div
                          className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-green-600 dark:text-green-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          onClick={() => {
                            const basePath = isAdmin ? '/admin' : '/user';
                            const encodedUrl = encodeURIComponent(attachment.url);
                            window.open(`${basePath}/view/preview?url=${encodedUrl}&type=document&name=PendingAttachment${index + 1}`, '_blank');
                          }}
                        >
                          <FaFile size={24} />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(index)}
                        className="absolute top-0 right-0 p-1 bg-red-500 text-white hover:bg-red-600 rounded-bl"
                        title="Remove"
                      >
                        <FaTimes className="text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Buttons */}
            <div className="flex items-center gap-2 mb-3">
              <label className={`flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg text-sm ${uploading.image ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40'
                }`}>
                {uploading.image ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaImage className="text-blue-700 dark:text-blue-400" />}
                <span className="text-blue-700 dark:text-blue-400">Image</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttachmentUpload(e, 'image')}
                  disabled={uploading.image || uploading.video || uploading.document}
                />
              </label>
              <label className={`flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg text-sm ${uploading.video ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40'
                }`}>
                {uploading.video ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaVideo className="text-purple-700 dark:text-purple-400" />}
                <span className="text-purple-700 dark:text-purple-400">Video</span>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttachmentUpload(e, 'video')}
                  disabled={uploading.image || uploading.video || uploading.document}
                />
              </label>
              <label className={`flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-sm ${uploading.document ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40'
                }`}>
                {uploading.document ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaFile className="text-green-700 dark:text-green-400" />}
                <span className="text-green-700 dark:text-green-400">Document</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttachmentUpload(e, 'document')}
                  disabled={uploading.image || uploading.video || uploading.document}
                />
              </label>
            </div>

            <button
              onClick={handleSendMessage}
              disabled={sending || (!newMessage.trim() && attachments.length === 0)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaPaperPlane />}
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        )}
      </div>

      {/* Admin Actions */}
      {isAdmin && dispute.status !== 'resolved' && dispute.status !== 'closed' && (
        <div className="border-t dark:border-gray-700 pt-4 mt-6">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Admin Actions</h4>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShowStatusModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <FaEdit /> Update Status
            </button>
            <button
              onClick={() => setShowResolveModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <FaCheckCircle /> Resolve Dispute
            </button>
          </div>
        </div>
      )}

      {/* Property Management Actions */}
      {isAdmin && dispute.bookingId && dispute.bookingId.listingId?.availabilityStatus !== 'available' && (
        <div className="border-t dark:border-gray-700 pt-4 mt-6">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Property Management</h4>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleRepublish}
              disabled={republishing}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50"
            >
              {republishing ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaSync />}
              Republish Property
            </button>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Update Dispute Status</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {Object.entries(DISPUTE_STATUS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Priority</label>
                <select
                  value={statusForm.priority}
                  onChange={(e) => setStatusForm({ ...statusForm, priority: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              {statusForm.status === 'escalated' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Escalation Reason</label>
                  <textarea
                    value={statusForm.escalationReason}
                    onChange={(e) => setStatusForm({ ...statusForm, escalationReason: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Reason for escalation..."
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (onUpdateStatus) {
                      onUpdateStatus(dispute._id, statusForm.status, statusForm.priority, statusForm.escalationReason);
                    }
                    setShowStatusModal(false);
                  }}
                  disabled={updatingStatus}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingStatus ? 'Updating...' : 'Update'}
                </button>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Resolve Dispute</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Resolution Decision</label>
                <select
                  value={resolveForm.resolution}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolution: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Select decision...</option>
                  <option value="favor_raised_by">In favor of {dispute.raisedBy?.username || 'complainant'}</option>
                  <option value="favor_raised_against">In favor of {dispute.raisedAgainst?.username || 'respondent'}</option>
                  <option value="partial">Partial resolution</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Resolution Notes</label>
                <textarea
                  value={resolveForm.resolutionNotes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Detailed resolution notes..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (onResolve && resolveForm.resolution) {
                      onResolve(dispute._id, resolveForm.resolution, resolveForm.resolutionNotes);
                    }
                    setShowResolveModal(false);
                  }}
                  disabled={resolving || !resolveForm.resolution}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {resolving ? 'Resolving...' : 'Resolve'}
                </button>
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Image Preview Modal */}
      {showImagePreview && selectedImage && (
        <ImagePreview
          isOpen={showImagePreview}
          onClose={() => {
            setShowImagePreview(false);
            setSelectedImage(null);
          }}
          images={[selectedImage]}
        />
      )}

      {/* Video Preview Modal */}
      {showVideoPreview && selectedVideo && (
        <VideoPreview
          isOpen={showVideoPreview}
          onClose={() => {
            setShowVideoPreview(false);
            setSelectedVideo(null);
          }}
          videos={[selectedVideo]}
        />
      )}
    </div>
  );
}

