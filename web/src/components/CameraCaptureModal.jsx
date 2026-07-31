import React, { useState, useEffect, useRef } from 'react';
import { FaCamera, FaTimes, FaSync, FaCheck, FaUndo, FaExclamationTriangle } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const CameraCaptureModal = ({ isOpen, onClose, onCapture }) => {
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Camera...');
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (rear)
  const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stop camera tracks helper
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Enumerate video devices
  const detectDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(videoInputs);
      }
    } catch (e) {
      console.warn('[CameraCaptureModal] Device enumeration error:', e);
    }
  };

  // Start camera stream
  const startCameraStream = async (customLoadingText) => {
    setIsLoading(true);
    if (customLoadingText) {
      setLoadingMessage(customLoadingText);
    }
    setCameraError(null);
    stopCameraStream();

    try {
      let constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      if (currentDeviceId) {
        constraints.video.deviceId = { exact: currentDeviceId };
      } else {
        constraints.video.facingMode = facingMode;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }

      await detectDevices();
      setIsLoading(false);
      setIsSwitching(false);
    } catch (err) {
      console.error('[CameraCaptureModal] Camera access error:', err);
      setIsLoading(false);
      setIsSwitching(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another application.');
      } else {
        setCameraError('Failed to access camera. Please check your camera permissions.');
      }
    }
  };

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen && !capturedBlob) {
      setLoadingMessage(isSwitching ? 'Switching Camera...' : 'Initializing Camera...');
      startCameraStream();
    } else if (!isOpen) {
      stopCameraStream();
      setCapturedBlob(null);
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
        setCapturedPreviewUrl(null);
      }
      setCameraError(null);
      setIsSwitching(false);
      setLoadingMessage('Initializing Camera...');
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode, currentDeviceId]);

  // Connect stream to video element when ready
  useEffect(() => {
    if (videoRef.current && stream && !capturedBlob) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, capturedBlob]);

  // Switch camera handler
  const handleSwitchCamera = () => {
    setIsSwitching(true);
    setLoadingMessage('Switching Camera...');
    if (videoDevices.length > 1) {
      if (currentDeviceId) {
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        setCurrentDeviceId(videoDevices[nextIndex].deviceId);
      } else {
        setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
      }
    } else {
      setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
    }
  };

  // Capture snapshot photo
  const handleCapturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    
    // If using front camera ('user'), mirror canvas horizontally for natural selfie feel
    if (facingMode === 'user' && !currentDeviceId) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (blob) {
        const previewUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedPreviewUrl(previewUrl);
        stopCameraStream();
      }
    }, 'image/jpeg', 0.95);
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setCapturedBlob(null);
    setLoadingMessage('Initializing Camera...');
    startCameraStream('Initializing Camera...');
  };

  // Confirm photo (OK)
  const handleConfirmPhoto = () => {
    if (!capturedBlob) return;

    const fileName = `camera_photo_${Date.now()}.jpg`;
    const photoFile = new File([capturedBlob], fileName, { type: 'image/jpeg' });

    onCapture(photoFile);

    // Reset and close
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setCapturedBlob(null);
    stopCameraStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 sm:bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-0 sm:p-4 md:p-6 animate-fadeIn">
      <div className="bg-gray-950 border-0 sm:border border-gray-800/80 rounded-none sm:rounded-3xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[92vh] max-w-3xl overflow-hidden flex flex-col relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800/80 bg-gray-950/90 z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <FaCamera size={14} />
            </div>
            <span className="text-sm sm:text-base font-bold text-white tracking-wide">
              {capturedBlob ? 'Review Photo' : 'Take Photo'}
            </span>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors active:scale-95 border border-gray-700/50"
            title="Close Camera"
          >
            <FaTimes size={15} />
          </button>
        </div>

        {/* Viewport Box - Expanded height for mobile / small screen maximization */}
        <div className="relative flex-1 min-h-[55vh] sm:min-h-[50vh] sm:aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {/* Off-screen Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Captured Image Preview */}
          {capturedPreviewUrl ? (
            <img
              src={capturedPreviewUrl}
              alt="Captured preview"
              className="w-full h-full object-contain bg-black"
            />
          ) : cameraError ? (
            /* Error State */
            <div className="flex flex-col items-center justify-center p-6 text-center text-gray-300">
              <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/30 animate-pulse">
                <FaExclamationTriangle size={28} />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Camera Access Error</h4>
              <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
                {cameraError}
              </p>
              <button
                onClick={() => startCameraStream('Initializing Camera...')}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-purple-600/30 active:scale-95 flex items-center gap-2"
              >
                <FaUndo size={12} /> Retry Camera
              </button>
            </div>
          ) : (
            /* Live Camera Feed */
            <>
              {isLoading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 text-white">
                  <UrbanSetuSpinner size="md" className="mb-3 text-purple-400" />
                  <span className="text-xs sm:text-sm font-semibold tracking-wide text-gray-200">
                    {loadingMessage}
                  </span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  facingMode === 'user' && !currentDeviceId ? 'scale-x-[-1]' : ''
                } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              />
            </>
          )}
        </div>

        {/* Modal Controls Footer */}
        <div className="p-3 sm:p-5 bg-gray-950 border-t border-gray-800/80 flex items-center justify-between flex-shrink-0">
          {capturedBlob ? (
            /* Confirmation Actions: Retake or OK */
            <div className="flex items-center justify-between w-full gap-3 sm:gap-4">
              <button
                onClick={handleRetake}
                className="flex-1 py-3 px-4 sm:px-5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs sm:text-sm font-semibold tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 border border-gray-700"
              >
                <FaUndo size={13} className="text-gray-400" />
                <span>Retake</span>
              </button>
              <button
                onClick={handleConfirmPhoto}
                className="flex-1 py-3 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold tracking-wide transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-95 flex items-center justify-center gap-2 border border-white/20"
              >
                <FaCheck size={13} />
                <span>OK (Use Photo)</span>
              </button>
            </div>
          ) : (
            /* Live Camera Capture Controls */
            <div className="flex items-center justify-between w-full px-2 sm:px-6">
              {/* Secondary option: Cancel */}
              <button
                onClick={() => {
                  stopCameraStream();
                  onClose();
                }}
                className="px-3 sm:px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>

              {/* Shutter Button */}
              <button
                onClick={handleCapturePhoto}
                disabled={isLoading || !!cameraError}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-white p-1 flex items-center justify-center transition-all duration-300 ${
                  isLoading || cameraError
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:scale-105 active:scale-95 shadow-xl shadow-purple-500/20'
                }`}
                title="Capture Photo"
              >
                <div className="w-full h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 flex items-center justify-center">
                  <FaCamera size={18} className="text-white" />
                </div>
              </button>

              {/* Switch Camera Button */}
              <button
                onClick={handleSwitchCamera}
                disabled={isLoading || !!cameraError}
                className={`p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-all border border-gray-700 ${
                  isLoading || cameraError ? 'opacity-40 pointer-events-none' : 'active:scale-95'
                }`}
                title="Switch Camera"
              >
                <FaSync size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCaptureModal;

