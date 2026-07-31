import React from 'react';
import { FaTimes } from 'react-icons/fa';

const MediaPermissionModal = ({ isOpen, onClose, permissionType = 'video' }) => {
  if (!isOpen) return null;

  const isAudioOnly = permissionType === 'audio';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[110] p-3 sm:p-4 animate-fadeIn">
      <div className="bg-gray-900 border border-gray-800 text-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col p-5 sm:p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-gray-800 transition-colors"
          title="Close"
        >
          <FaTimes size={16} />
        </button>

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4 tracking-wide text-left pr-6">
          {isAudioOnly ? 'Allow microphone' : 'Allow camera and microphone'}
        </h3>

        {/* Description Text */}
        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-5 sm:mb-6 text-left">
          To make calls, UrbanSetu needs access to your {isAudioOnly ? 'microphone' : 'camera and microphone'}. Click the{' '}
          <span className="inline-flex items-center justify-center bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700 mx-0.5 align-middle">
            <svg viewBox="0 0 14 14" width="14" height="14" fill="none" className="text-gray-300">
              <title>chrome-permissions</title>
              <path fill="currentColor" fillRule="evenodd" d="M11.13 7.62a2.76 2.76 0 0 1 2.62 2.75v.15a2.76 2.76 0 0 1-2.76 2.62h-.14a2.76 2.76 0 0 1-2.62-2.62v-.15a2.76 2.76 0 0 1 2.76-2.76zm-.14 1.8a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.93" clipRule="evenodd" />
              <path fill="currentColor" d="M7 11.3H.86V9.45H7" />
              <path fill="currentColor" fillRule="evenodd" d="M3.15 0.8a2.76 2.76 0 0 1 2.62 2.75v.15a2.76 2.76 0 0 1-2.76 2.62h-.14a2.76 2.76 0 0 1-2.62-2.62V0.95A2.76 2.76 0 0 1 3.01 0.8zm-.14 1.8a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.93" clipRule="evenodd" />
              <path fill="currentColor" d="M13.14 4.51H7V2.7h6.14z" />
            </svg>
          </span>{' '}
          icon next to the address bar and toggle{' '}
          <strong className="text-white font-bold">
            {isAudioOnly ? 'Microphone' : 'Camera and Microphone'}
          </strong>{' '}
          on. If you've already updated your permission settings, reload the page for the change to take effect.
        </p>

        {/* Action Button */}
        <div className="flex justify-end w-full">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold py-2.5 px-6 rounded-full shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all text-center"
          >
            OK, got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaPermissionModal;
