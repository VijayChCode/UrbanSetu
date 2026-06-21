import React, { useEffect, useState, useRef } from 'react';
import { FaPhone, FaVideo, FaTimes } from 'react-icons/fa';
import MicLevelBar from './MicLevelBar';

const IncomingCallModal = ({ call, onAccept, onReject, preCallMuted, preCallVideoOff, setPreCallMuted, setPreCallVideoOff }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [previewStream, setPreviewStream] = useState(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => {
    if (call) {
      setIsVisible(true);
      setRinging(true);
    } else {
      setIsVisible(false);
      setRinging(false);
    }
  }, [call]);

  // Acquire preview stream when incoming call modal opens
  useEffect(() => {
    if (!call) {
      // Cleanup when call disappears
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
        setPreviewStream(null);
      }
      return;
    }

    let stream = null;
    let cancelled = false;

    const acquirePreview = async () => {
      try {
        const constraints = {
          audio: true,
          video: call.callType === 'video' ? true : false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!cancelled) {
          setPreviewStream(stream);
        } else {
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.warn('[IncomingCallModal] Could not acquire preview stream:', err.name);
      }
    };

    acquirePreview();

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [call?.callId]); // Only re-run when callId changes

  // Attach video preview to ref
  useEffect(() => {
    if (videoPreviewRef.current && previewStream && call?.callType === 'video') {
      videoPreviewRef.current.srcObject = previewStream;
      videoPreviewRef.current.muted = true;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [previewStream, call?.callType]);

  // Sync preCallMuted/preCallVideoOff to preview stream tracks
  useEffect(() => {
    if (!previewStream) return;
    previewStream.getAudioTracks().forEach(track => {
      track.enabled = !preCallMuted;
    });
  }, [preCallMuted, previewStream]);

  useEffect(() => {
    if (!previewStream || call?.callType !== 'video') return;
    previewStream.getVideoTracks().forEach(track => {
      track.enabled = !preCallVideoOff;
    });
  }, [preCallVideoOff, previewStream, call?.callType]);

  // Cleanup preview on accept/reject
  const handleAccept = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    onAccept();
  };

  const handleReject = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    onReject();
  };

  if (!call || !isVisible) return null;

  const isVideoCall = call.callType === 'video';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] transition-opacity duration-300"
      style={{ animation: 'fadeIn 0.3s ease-in' }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes ring {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
      
      <div 
        className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 sm:p-8 text-center max-w-md w-full mx-4 shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.4s ease-out' }}
      >
        {/* Video Preview (Video calls only) */}
        {isVideoCall && (
          <div className="relative mb-4 rounded-xl overflow-hidden bg-black aspect-video max-h-[200px] sm:max-h-[240px]">
            {previewStream && !preCallVideoOff ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
                <svg className="w-12 h-12 text-gray-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                </svg>
                <span className="text-gray-500 text-xs">Camera off</span>
              </div>
            )}
            {/* Mic level overlay on video */}
            {previewStream && (
              <div className="absolute bottom-2 left-2 bg-black/50 rounded-lg px-2 py-1 flex items-center gap-1.5">
                <svg className={`w-3 h-3 ${preCallMuted ? 'text-red-400' : 'text-white'}`} fill="currentColor" viewBox="0 0 24 24">
                  {preCallMuted ? (
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  ) : (
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  )}
                </svg>
                <MicLevelBar stream={previewStream} barCount={4} height="16px" theme="dark" muted={preCallMuted} />
              </div>
            )}
          </div>
        )}

        <div className={`${isVideoCall ? 'mb-4' : 'mb-6'} relative`}>
          {/* Pulsing ring effect — only for audio calls (video call has its own preview) */}
          {!isVideoCall && ringing && (
            <>
              <div 
                className="absolute inset-0 w-32 h-32 rounded-full mx-auto bg-green-500 opacity-20"
                style={{ 
                  animation: 'pulse-ring 2s ease-out infinite',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: '-16px'
                }}
              />
              <div 
                className="absolute inset-0 w-32 h-32 rounded-full mx-auto bg-green-500 opacity-10"
                style={{ 
                  animation: 'pulse-ring 2s ease-out infinite 0.5s',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: '-16px'
                }}
              />
            </>
          )}
          
          {/* Icon — only show for audio calls; for video calls it's been replaced by the preview */}
          {!isVideoCall && (
            <div 
              className="w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center relative z-10 bg-gradient-to-br from-green-500 to-green-600 shadow-xl"
              style={{ animation: ringing ? 'ring 1s ease-in-out infinite' : 'none' }}
            >
              <FaPhone className="text-white text-5xl" />
            </div>
          )}
          
          <h3 className="text-2xl sm:text-3xl font-bold mb-1 text-gray-800 dark:text-white">{call.callerName || 'Incoming Call'}</h3>
          <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg">
            {isVideoCall ? 'Video' : 'Audio'} Call
          </p>
        </div>

        {/* Audio call mic level bar */}
        {!isVideoCall && previewStream && (
          <div className="mb-4 flex flex-col items-center gap-1">
            <MicLevelBar stream={previewStream} barCount={7} height="28px" theme="light" muted={preCallMuted} />
            <span className={`text-[10px] font-medium ${preCallMuted ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {preCallMuted ? 'Mic muted' : 'Your mic'}
            </span>
          </div>
        )}

        {/* Pre-call preference toggles */}
        <div className="mb-5">
          <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-3">Join preferences</p>
          <div className="flex items-center justify-center gap-3">
            {/* Mic toggle */}
            <button
              onClick={() => setPreCallMuted && setPreCallMuted(!preCallMuted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:scale-110 active:scale-95 ${
                preCallMuted
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-500 ring-2 ring-red-300 dark:ring-red-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={preCallMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {preCallMuted ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              )}
            </button>

            {/* Video toggle (only for video calls) */}
            {isVideoCall && (
              <button
                onClick={() => setPreCallVideoOff && setPreCallVideoOff(!preCallVideoOff)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md hover:scale-110 active:scale-95 ${
                  preCallVideoOff
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-500 ring-2 ring-red-300 dark:ring-red-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={preCallVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {preCallVideoOff ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                )}
              </button>
            )}
          </div>
          {/* Status labels */}
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className={`text-[10px] font-medium ${preCallMuted ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {preCallMuted ? 'Mic off' : 'Mic on'}
            </span>
            {isVideoCall && (
              <span className={`text-[10px] font-medium ${preCallVideoOff ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {preCallVideoOff ? 'Camera off' : 'Camera on'}
              </span>
            )}
          </div>
        </div>
        
        {/* Reject / Accept buttons */}
        <div className="flex gap-6 justify-center">
          <button
            onClick={handleReject}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-300 shadow-xl hover:scale-110 active:scale-95 transform"
            title="Reject"
          >
            <FaTimes className="text-2xl sm:text-3xl" />
          </button>
          <button
            onClick={handleAccept}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-all duration-300 shadow-xl hover:scale-110 active:scale-95 transform ${
              isVideoCall 
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' 
                : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
            }`}
            title="Accept"
          >
            <FaPhone className="text-2xl sm:text-3xl" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
