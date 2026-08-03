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
  const [isMirrored, setIsMirrored] = useState(true); // Horizontal mirror flip state
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
      setIsMirrored(true);
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

  // Switch camera / mirror flip handler
  const handleSwitchCamera = () => {
    if (videoDevices.length > 1) {
      setIsSwitching(true);
      setLoadingMessage('Switching Camera...');
      if (currentDeviceId) {
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        setCurrentDeviceId(videoDevices[nextIndex].deviceId);
      } else {
        const nextFacing = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(nextFacing);
        setIsMirrored(nextFacing === 'user');
      }
    } else {
      // Single camera (Desktop/Laptop): Toggle horizontal mirror effect smoothly without re-querying stream
      setIsMirrored(prev => !prev);
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
    
    // Apply horizontal mirror transformation if isMirrored is true
    if (isMirrored) {
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
      <div className="bg-black border-0 sm:border border-gray-800/80 rounded-none sm:rounded-3xl shadow-2xl w-full h-full sm:h-[85vh] max-w-4xl overflow-hidden flex flex-col relative">
        
        {/* Floating Header */}
        <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 sm:px-6 py-4 sm:py-5 z-30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-purple-500/20 backdrop-blur-md text-purple-400 flex items-center justify-center border border-purple-500/30 shadow-lg">
              <FaCamera size={15} />
            </div>
            <span className="text-sm sm:text-base font-bold text-white tracking-wide drop-shadow-md">
              {capturedBlob ? 'Review Photo' : 'Take Photo'}
            </span>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 hover:bg-black/80 text-gray-300 hover:text-white flex items-center justify-center transition-colors active:scale-95 border border-white/20 backdrop-blur-md shadow-lg"
            title="Close Camera"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Fullscreen Video / Image Viewport Container */}
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
          {/* Off-screen Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Captured Image Preview */}
          {capturedPreviewUrl ? (
            <img
              src={capturedPreviewUrl}
              alt="Captured preview"
              className="w-full h-full object-cover bg-black"
            />
          ) : cameraError ? (
            /* Error State with Top-Left Browser Permission Arrow */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center text-gray-300 overflow-hidden z-20">
              {/* Top-Left Directional Pointer to Browser Address Bar Site Info Icon */}
              <div className="absolute top-16 left-4 sm:left-6 z-30 flex flex-col items-start pointer-events-none animate-pulse">
                <svg className="w-20 h-20 sm:w-24 sm:h-24 filter drop-shadow-[0_0_16px_rgba(168,85,247,0.85)]" viewBox="0 0 120 120" fill="none">
                  <path
                    d="M 95 95 C 20 110 -10 40 40 35 C 75 30 75 75 45 75 C 20 75 15 35 25 15"
                    stroke="#A855F7"
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <polygon points="25,10 10,32 38,28" fill="#A855F7" />
                </svg>
                <div className="bg-slate-900/95 text-gray-200 text-[11px] sm:text-xs font-semibold p-3 rounded-xl shadow-2xl border border-purple-500/40 backdrop-blur-md tracking-wide mt-1 max-w-[270px] text-left leading-snug shadow-purple-950/80">
                  <div className="flex items-center gap-1.5 mb-1.5 font-extrabold text-purple-300">
                    <svg viewBox="0 0 14 14" width="16" height="16" fill="none" className="inline-block text-cyan-300 flex-shrink-0">
                      <title>chrome-permissions</title>
                      <path fill="currentColor" fillRule="evenodd" d="M11.13 7.62a2.76 2.76 0 0 1 2.62 2.75v.15a2.76 2.76 0 0 1-2.76 2.62h-.14a2.76 2.76 0 0 1-2.62-2.62v-.15a2.76 2.76 0 0 1 2.76-2.76zm-.14 1.8a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.93" clipRule="evenodd" />
                      <path fill="currentColor" d="M7 11.3H.86V9.45H7" />
                      <path fill="currentColor" fillRule="evenodd" d="M3.15 0.8a2.76 2.76 0 0 1 2.62 2.75v.15a2.76 2.76 0 0 1-2.76 2.62h-.14a2.76 2.76 0 0 1-2.62-2.62V0.95A2.76 2.76 0 0 1 3.01 0.8zm-.14 1.8a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.93" clipRule="evenodd" />
                      <path fill="currentColor" d="M13.14 4.51H7V2.7h6.14z" />
                    </svg>
                    <span>Click Chrome Permissions Icon</span>
                  </div>
                  Click the <span className="inline-flex items-center gap-1 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-400/50 text-cyan-300 font-bold"><svg viewBox="0 0 14 14" width="13" height="13" fill="none" className="text-cyan-300"><path fill="currentColor" fillRule="evenodd" d="M11.13 7.62a2.76 2.76 0 0 1 2.62 2.75v.15a2.76 2.76 0 0 1-2.76 2.62h-.14a2.76 2.76 0 0 1-2.62-2.62v-.15a2.76 2.76 0 0 1 2.76-2.76zm-.14 1.8a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.93" clipRule="evenodd" /><path fill="currentColor" d="M7 11.3H.86V9.45H7" /><path fill="currentColor" fillRule="evenodd" d="M3.15 0.8a2.76 2.76 0 0 1 2.62 2.75v.15a2.76 2.76 0 0 1-2.76 2.62h-.14a2.76 2.76 0 0 1-2.62-2.62V0.95A2.76 2.76 0 0 1 3.01 0.8zm-.14 1.8a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.93" clipRule="evenodd" /><path fill="currentColor" d="M13.14 4.51H7V2.7h6.14z" /></svg> Site info icon</span> next to the address bar and toggle <span className="font-bold text-cyan-300">Camera</span> on.
                </div>
              </div>

              <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/30 animate-pulse mt-14 sm:mt-0">
                <FaExclamationTriangle size={28} />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Camera Access Error</h4>
              <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
                {cameraError}
              </p>
              <button
                onClick={() => startCameraStream('Initializing Camera...')}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-purple-600/30 active:scale-95 flex items-center gap-2 z-10"
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
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  isMirrored ? 'scale-x-[-1]' : 'scale-x-1'
                } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              />
            </>
          )}
        </div>

        {/* Floating Bottom Controls Footer */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between z-30">
          {capturedBlob ? (
            /* Confirmation Actions: Retake or OK */
            <div className="flex items-center justify-between w-full gap-3 sm:gap-4 max-w-md mx-auto">
              <button
                onClick={handleRetake}
                className="flex-1 py-3 px-4 sm:px-5 rounded-full bg-black/60 hover:bg-black/80 text-gray-200 text-xs sm:text-sm font-semibold tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/20 backdrop-blur-md shadow-lg"
              >
                <FaUndo size={13} className="text-gray-400" />
                <span>Retake</span>
              </button>
              <button
                onClick={handleConfirmPhoto}
                className="flex-1 py-3 px-4 sm:px-5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 active:scale-95 flex items-center justify-center gap-2 border border-white/30 backdrop-blur-md"
              >
                <FaCheck size={13} />
                <span>OK (Use Photo)</span>
              </button>
            </div>
          ) : (
            /* Live Camera Capture Controls */
            <div className="flex items-center justify-between w-full max-w-md mx-auto px-2">
              {/* Secondary option: Cancel */}
              <button
                onClick={() => {
                  stopCameraStream();
                  onClose();
                }}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white/80 hover:text-white transition-colors drop-shadow-md bg-black/40 hover:bg-black/60 rounded-full border border-white/10 backdrop-blur-md"
              >
                Cancel
              </button>

              {/* Shutter Button */}
              <button
                onClick={handleCapturePhoto}
                disabled={isLoading || !!cameraError}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white p-1 flex items-center justify-center transition-all duration-300 ${
                  isLoading || cameraError
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:scale-105 active:scale-95 shadow-2xl shadow-purple-500/40'
                }`}
                title="Capture Photo"
              >
                <div className="w-full h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 flex items-center justify-center shadow-inner">
                  <FaCamera size={22} className="text-white drop-shadow-sm" />
                </div>
              </button>

              {/* Switch Camera / Mirror Toggle Button */}
              <button
                onClick={handleSwitchCamera}
                disabled={isLoading || !!cameraError}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/20 backdrop-blur-md shadow-lg ${
                  isLoading || cameraError ? 'opacity-40 pointer-events-none' : 'active:scale-95'
                }`}
                title={videoDevices.length > 1 ? 'Switch Camera' : 'Flip Mirror View'}
              >
                <FaSync size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCaptureModal;

