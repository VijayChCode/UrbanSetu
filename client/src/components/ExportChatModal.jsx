import React, { useState } from 'react';
import { FaDownload, FaTimes, FaImage, FaFile, FaSpinner } from 'react-icons/fa';

const ExportChatModal = ({ 
  isOpen, 
  onClose, 
  onExport, 
  appointment, 
  messageCount, 
  imageCount 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState('with-media'); // 'with-media' or 'without-media'

  if (!isOpen) return null;

  const handleExport = async (includeMedia) => {
    setIsExporting(true);
    try {
      await onExport(includeMedia);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Export Chat Transcript
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isExporting}
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Appointment Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Appointment Details</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Property:</strong> {appointment?.propertyName || 'N/A'}</div>
              <div><strong>Date:</strong> {new Date(appointment?.date).toLocaleDateString()}</div>
              <div><strong>Messages:</strong> {messageCount} messages</div>
              <div><strong>Images:</strong> {imageCount} images</div>
            </div>
          </div>

          {/* Export Options */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-4">Export Options</h4>
            
            {/* With Media Option */}
            <div className="mb-4">
              <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="with-media"
                  checked={exportType === 'with-media'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="mr-3"
                />
                <div className="flex items-center">
                  <FaImage className="text-blue-500 mr-3" size={20} />
                  <div>
                    <div className="font-medium text-gray-900">With Media</div>
                    <div className="text-sm text-gray-600">
                      Include all images in the PDF (larger file size)
                    </div>
                  </div>
                </div>
              </label>
            </div>

            {/* Without Media Option */}
            <div>
              <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="without-media"
                  checked={exportType === 'without-media'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="mr-3"
                />
                <div className="flex items-center">
                  <FaFile className="text-green-500 mr-3" size={20} />
                  <div>
                    <div className="font-medium text-gray-900">Text Only</div>
                    <div className="text-sm text-gray-600">
                      Text messages only with image placeholders (smaller file)
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* File Size Estimate */}
          <div className="mb-6 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>Estimated file size:</strong> {' '}
              {exportType === 'with-media' ? 
                `${Math.max(1, Math.ceil(imageCount * 0.5 + messageCount * 0.01))} MB` : 
                `${Math.max(0.1, Math.ceil(messageCount * 0.01))} MB`
              }
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => handleExport(exportType === 'with-media')}
            disabled={isExporting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isExporting ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <FaDownload className="mr-2" />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportChatModal;