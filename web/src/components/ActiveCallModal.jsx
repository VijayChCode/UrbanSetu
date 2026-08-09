import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { FaPhone, FaVideo, FaMicrophone, FaMicrophoneSlash, FaVideoSlash, FaSync, FaExpand, FaCompress, FaDesktop, FaSignLanguage, FaWifi, FaVolumeUp, FaWaveSquare, FaVolumeMute, FaChevronDown, FaHistory, FaClock, FaCheckCircle, FaUser, FaTimes, FaLock } from 'react-icons/fa';
import UserAvatar from './UserAvatar';
import { useAudioActivity } from '../hooks/useAudioActivity';

const ActiveCallModal = ({
  callState,
  callType,

  otherPartyName,
  otherPartyData, // Add other party data for avatar
  isMuted,
  isVideoEnabled,
  remoteIsMuted,
  remoteVideoEnabled,
  callDuration,
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  availableCameras,
  currentCameraId,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onSwitchCamera,
  onToggleScreenShare,
  onToggleFullscreen,
  isScreenSharing,
  remoteIsScreenSharing,
  cameraStreamDuringScreenShare,
  screenShareStream,
  isFullscreen,
  connectionQuality,
  availableMicrophones,
  availableSpeakers,
  currentMicrophoneId,
  currentSpeakerId,
  onSwitchMicrophone,
  onSwitchSpeaker,
  containerRef: containerRefProp,
  isSyncingSummary,
  isReconnecting,
  reconnectReason,
  onMinimize
}) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [showEncryptionNotice, setShowEncryptionNotice] = useState(true);

  useEffect(() => {
    setShowEncryptionNotice(true);
    const timer = setTimeout(() => {
      setShowEncryptionNotice(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [callState]);

  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoSwapped, setVideoSwapped] = useState(false); // Track if local/remote videos are swapped
  const controlsTimeoutRef = useRef(null);
  const containerRefLocal = useRef(null);
  const containerRef = containerRefProp || containerRefLocal; // Use prop if provided, otherwise use local ref
  const streamsRef = useRef({ local: null, remote: null }); // Store streams persistently
  const screenShareVideoRef = useRef(null); // Ref for screen share video element
  const cameraVideoSmallRef = useRef(null); // Ref for camera video in small window during screen share
  const smallRemoteVideoRef = useRef(null); // Ref for remote video in small window when remote is sharing (to duplicate stream)
  const [videoZoom, setVideoZoom] = useState(1); // Zoom level for video (like Google Meet)
  const [videoPanX, setVideoPanX] = useState(0); // Pan X offset for zoomed video
  const [videoPanY, setVideoPanY] = useState(0); // Pan Y offset for zoomed video
  const [forceRender, setForceRender] = useState(0); // Force re-render when screen share state changes
  const [presentationLoading, setPresentationLoading] = useState(false); // Loading state for presentation switching
  const isPanningRef = useRef(false); // Track if user is panning
  const lastPanPosRef = useRef({ x: 0, y: 0 }); // Last pan position

  // PiP Draggability state
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 }); // Offset from initial position
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const pipDragStartRef = useRef({ x: 0, y: 0 });

  // Audio activity detection
  const isLocalSpeaking = useAudioActivity(localStream);
  const isRemoteSpeaking = useAudioActivity(remoteStream);

  const [isRemoteAudioLocallyMuted, setIsRemoteAudioLocallyMuted] = useState(false);
  const [presentationAlert, setPresentationAlert] = useState(null); // State for "X is presenting" animation

  // Check for SinkId support (audio output selection)
  const supportsSetSinkId = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  // Refs to track previous screen share states for transition detection
  const prevIsScreenSharing = useRef(false);
  const prevRemoteIsScreenSharing = useRef(false);

  // Handle screen share alerts (Starts and Stops)
  useEffect(() => {
    // Detect local screen sharing transitions
    if (isScreenSharing && !prevIsScreenSharing.current) {
      setPresentationAlert({ text: 'You are presenting', color: 'bg-blue-600' });
      setTimeout(() => setPresentationAlert(prev => prev?.text === 'You are presenting' ? null : prev), 3000);
    } else if (!isScreenSharing && prevIsScreenSharing.current) {
      setPresentationAlert({ text: 'Presentation stopped', color: 'bg-gray-700/80 backdrop-blur-md' });
      setTimeout(() => setPresentationAlert(prev => prev?.text === 'Presentation stopped' ? null : prev), 3000);
    }

    // Detect remote screen sharing transitions
    if (remoteIsScreenSharing && !prevRemoteIsScreenSharing.current) {
      setPresentationAlert({ text: `${otherPartyName || 'Caller'} is presenting`, color: 'bg-purple-600' });
      setTimeout(() => setPresentationAlert(prev => prev?.text?.includes('is presenting') ? null : prev), 3000);
    } else if (!remoteIsScreenSharing && prevRemoteIsScreenSharing.current) {
      setPresentationAlert({ text: 'Presentation stopped', color: 'bg-gray-700/80 backdrop-blur-md' });
      setTimeout(() => setPresentationAlert(prev => prev?.text === 'Presentation stopped' ? null : prev), 3000);
    }

    // Update refs for next render
    prevIsScreenSharing.current = isScreenSharing;
    prevRemoteIsScreenSharing.current = remoteIsScreenSharing;
  }, [isScreenSharing, remoteIsScreenSharing, otherPartyName]);

  // Apply local mute to remote streams whenever the state or refs change
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isRemoteAudioLocallyMuted;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isRemoteAudioLocallyMuted;
    }
  }, [isRemoteAudioLocallyMuted, remoteStream]); // Re-run when stream changes to ensure mute persists


  useEffect(() => {
    setIsVisible(true);

    // Automatically launch fullscreen for video calls on accept/mount
    if (callType === 'video' && !isFullscreen) {
      // 1 second delay to ensure the click interaction (accept) is still within the browser's 
      // temporal window for fullscreen authorization. 
      const fsTimeout = setTimeout(() => {
        onToggleFullscreen?.();
      }, 1000);
      return () => clearTimeout(fsTimeout);
    }
  }, []);

  // Update streams ref when they change
  useEffect(() => {
    if (localStream) {
      streamsRef.current.local = localStream;
    }
    if (remoteStream) {
      streamsRef.current.remote = remoteStream;
    }
  }, [localStream, remoteStream]);

  // Handle screen share stream updates
  useEffect(() => {
    if (isScreenSharing) {
      // When screen sharing starts, ensure streams are attached
      if (screenShareStream && screenShareVideoRef.current) {
        if (screenShareVideoRef.current.srcObject !== screenShareStream) {
          screenShareVideoRef.current.srcObject = screenShareStream;
          screenShareVideoRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing screen share:', err); });
        }
      }
      if (cameraStreamDuringScreenShare && cameraVideoSmallRef.current) {
        if (cameraVideoSmallRef.current.srcObject !== cameraStreamDuringScreenShare) {
          cameraVideoSmallRef.current.srcObject = cameraStreamDuringScreenShare;
          cameraVideoSmallRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing camera stream:', err); });
        }
      }
    } else {
      // When screen sharing stops, ensure local video shows camera again
      if (localVideoRef.current && localStream) {
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing local video after screen share:', err); });
        }
      }
      // Reset zoom/pan when screen sharing stops
      setVideoZoom(1);
      setVideoPanX(0);
      setVideoPanY(0);
    }
  }, [isScreenSharing, screenShareStream, cameraStreamDuringScreenShare, localStream]);

  // Reset zoom/pan and force UI update when remote screen sharing state changes
  useEffect(() => {
    if (!remoteIsScreenSharing) {
      setVideoZoom(1);
      setVideoPanX(0);
      setVideoPanY(0);

      // Force a re-render to update the UI layout immediately
      setForceRender(prev => prev + 1);

      // When remote stops screen sharing, ensure the video element is updated
      if (remoteVideoRef.current && remoteStream) {
        // Ensure the video element is in sync with the remote stream
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.muted = isRemoteAudioLocallyMuted;
          remoteVideoRef.current.play().catch(err => {
            if (err.name !== 'AbortError') console.error('Error playing remote video after screen share ends:', err);
          });
        }
      }
    } else {
      // When remote starts screen sharing, also force render
      setForceRender(prev => prev + 1);
      // Set loading state
      setPresentationLoading(true);
      setTimeout(() => setPresentationLoading(false), 1500);
    }
  }, [remoteIsScreenSharing, remoteStream]);

  // Handle local screen share loading state
  useEffect(() => {
    if (isScreenSharing) {
      setPresentationLoading(true);
      setTimeout(() => setPresentationLoading(false), 1500);
    }
  }, [isScreenSharing]);

  // Handle small remote video stream attachment (for Presentee side)
  useEffect(() => {
    if (remoteIsScreenSharing && smallRemoteVideoRef.current && remoteStream) {
      if (smallRemoteVideoRef.current.srcObject !== remoteStream) {
        smallRemoteVideoRef.current.srcObject = remoteStream;
        // Mute it because the main window likely has audio, or we don't want double audio? 
        // Usually remoteStream has audio. If we play it twice, it gets louder. 
        // Safe to mute the small window mirror.
        smallRemoteVideoRef.current.muted = true;
        smallRemoteVideoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') console.error('Error playing small remote video:', err);
        });
      }
    }
  }, [remoteIsScreenSharing, remoteStream]);

  // Handle zoom with mouse wheel
  const handleWheel = (e) => {
    if (!isScreenSharing && !remoteIsScreenSharing) return;

    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(3, videoZoom * delta));
    setVideoZoom(newZoom);

    // Center zoom on mouse position
    if (newZoom > 1 && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 100;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 100;
      setVideoPanX(prev => prev - x * (newZoom - videoZoom));
      setVideoPanY(prev => prev - y * (newZoom - videoZoom));
    }
  };

  // Handle mouse down for panning
  const handleMouseDown = (e) => {
    if (videoZoom > 1 && (isScreenSharing || remoteIsScreenSharing)) {
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e) => {
    if (isPanningRef.current && videoZoom > 1) {
      const deltaX = e.clientX - lastPanPosRef.current.x;
      const deltaY = e.clientY - lastPanPosRef.current.y;
      setVideoPanX(prev => prev + (deltaX / window.innerWidth) * 100 * (1 / videoZoom));
      setVideoPanY(prev => prev + (deltaY / window.innerHeight) * 100 * (1 / videoZoom));
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  // Handle mouse up for panning
  const handleMouseUp = () => {
    isPanningRef.current = false;
  };

  // Add global mouse event listeners for panning
  useEffect(() => {
    if (videoZoom > 1) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [videoZoom]);

  // Handle PiP dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingPip) {
        const newX = e.clientX - pipDragStartRef.current.x;
        const newY = e.clientY - pipDragStartRef.current.y;

        // Boundaries check (keep it inside the modal)
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          // Keep it inside the modal roughly
          const boundedX = Math.max(-(rect.width - 100), Math.min(100, newX));
          const boundedY = Math.max(-(rect.height - 100), Math.min(100, newY));

          setPipPos({ x: newX, y: newY });
        } else {
          setPipPos({ x: newX, y: newY });
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingPip(false);
    };

    if (isDraggingPip) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchmove', (e) => handleGlobalMouseMove(e.touches[0]));
      window.addEventListener('touchend', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingPip, containerRef]);

  const handlePipMouseDown = (e) => {
    if (callType !== 'video') return;

    // Check if it's a touch event or mouse left click
    if (e.type === 'mousedown' && e.button !== 0) return;

    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    setIsDraggingPip(true);
    pipDragStartRef.current = {
      x: clientX - pipPos.x,
      y: clientY - pipPos.y
    };
    e.stopPropagation();
  };

  // Maintain video streams when views are swapped
  useEffect(() => {
    if (callType !== 'video') return;

    // Get streams from ref (persistent across re-renders) or from props
    const localStreamObj = streamsRef.current.local || localStream;
    const remoteStreamObj = streamsRef.current.remote || remoteStream;

    if (!localStreamObj || !remoteStreamObj) {
      return;
    }

    // Small delay to ensure React has updated the DOM with new video elements
    const timeoutId = setTimeout(() => {
      // Re-attach streams to the new video elements after swap
      if (videoSwapped) {
        // Local is in large view, remote is in small view
        if (localVideoRef.current && localStreamObj) {
          if (localVideoRef.current.srcObject !== localStreamObj) {
            localVideoRef.current.srcObject = localStreamObj;
            localVideoRef.current.muted = true;
          }
          localVideoRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing local video after swap:', err); });
        }
        if (remoteVideoRef.current && remoteStreamObj) {
          if (remoteVideoRef.current.srcObject !== remoteStreamObj) {
            remoteVideoRef.current.srcObject = remoteStreamObj;
            remoteVideoRef.current.muted = isRemoteAudioLocallyMuted;
          }
          remoteVideoRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing remote video after swap:', err); });
        }
      } else {
        // Remote is in large view, local is in small view (default)
        if (remoteVideoRef.current && remoteStreamObj) {
          if (remoteVideoRef.current.srcObject !== remoteStreamObj) {
            remoteVideoRef.current.srcObject = remoteStreamObj;
            remoteVideoRef.current.muted = isRemoteAudioLocallyMuted;
          }
          remoteVideoRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing remote video after swap:', err); });
        }
        if (localVideoRef.current && localStreamObj) {
          if (localVideoRef.current.srcObject !== localStreamObj) {
            localVideoRef.current.srcObject = localStreamObj;
            localVideoRef.current.muted = true;
          }
          localVideoRef.current.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing local video after swap:', err); });
        }
      }
    }, 100); // Slightly longer delay to ensure DOM is ready

    return () => clearTimeout(timeoutId);
  }, [videoSwapped, callType, localStream, remoteStream, localVideoRef, remoteVideoRef, isScreenSharing, remoteIsScreenSharing]);

  // Show controls on mouse movement and auto-hide after 3 seconds of inactivity
  useEffect(() => {
    if (callType === 'video') {
      const handleMouseMove = () => {
        setControlsVisible(true);
        // Clear existing timeout
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        // Hide controls after 3 seconds of inactivity
        controlsTimeoutRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, 3000);
      };

      const container = containerRef.current;
      if (container) {
        container.addEventListener('mousemove', handleMouseMove);
        return () => {
          container.removeEventListener('mousemove', handleMouseMove);
          if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
          }
        };
      }
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [callType]);

  // Show controls when clicking on video
  const handleVideoClick = () => {
    if (callType === 'video') {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      // Hide again after 3 seconds
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  };

  // Direct camera toggle logic with cycle switching
  const handleCameraToggle = (e) => {
    if (e) e.stopPropagation();
    if (!availableCameras || availableCameras.length < 2) return;

    setIsSwitchingCamera(true);

    // Identify next camera in sequence
    const currentIndex = availableCameras.findIndex(c => c.deviceId === currentCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];

    if (nextCamera) {
      onSwitchCamera(nextCamera.deviceId);
    }

    // Reset animation state after rotation completes (600ms)
    setTimeout(() => {
      setIsSwitchingCamera(false);
    }, 600);
  };

  // Handle local video click to swap views
  const handleLocalVideoClick = (e) => {
    e.stopPropagation();
    if (callType === 'video') {
      setVideoSwapped(!videoSwapped);
      setControlsVisible(true);
      // Hide again after 3 seconds
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  };

  const formatDuration = (seconds) => {
    // Ensure non-negative duration (handle edge cases and clock skew)
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black flex flex-col z-[9999] transition-opacity duration-300 overflow-hidden"
      style={{ animation: 'fadeIn 0.3s ease-in' }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rotateSync {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes encryptionNotice {
          0% { transform: translate(-50%, -120%); opacity: 0; }
          15% { transform: translate(-50%, 0); opacity: 1; }
          82% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -120%); opacity: 0; }
        }
      `}</style>

      {/* Secure & Encrypted Call Notification */}
      {showEncryptionNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-[encryptionNotice_4.5s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-full shadow-2xl shadow-emerald-500/20 flex items-center gap-2.5 text-xs font-semibold tracking-wide">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FaLock className="text-[11px] animate-pulse" />
            </div>
            <span>Secure & Encrypted Call</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>
      )}

      {/* Presentation Alert Overlay */}
      {presentationAlert && (
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-[popIn_0.5s_ease-out_forwards]">
          <div className={`${presentationAlert.color} text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white/20`}>
            <FaDesktop className="text-2xl animate-pulse" />
            <span className="text-xl font-bold">{presentationAlert.text}</span>
          </div>
        </div>
      )}

      {/* Connection Quality Indicator - positioned below timer */}
      {connectionQuality && (
        <div className="absolute top-16 right-4 z-30 flex items-center gap-2 bg-black bg-opacity-70 rounded-full px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${connectionQuality === 'excellent' ? 'bg-green-500' :
            connectionQuality === 'good' ? 'bg-green-400' :
              connectionQuality === 'fair' ? 'bg-yellow-500' :
                'bg-red-500'
            }`}></div>
          <span className="text-white text-xs font-medium capitalize">{connectionQuality}</span>
        </div>
      )}

      {/* Top Controls for Video Calls */}
      {callType === 'video' && (
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          {/* Screen Share Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleScreenShare?.();
            }}
            className={`p-2 rounded-full transition-all duration-300 ${isScreenSharing ? 'bg-blue-500 hover:bg-blue-600' : 'bg-black bg-opacity-70 hover:bg-opacity-90'
              } text-white`}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <FaDesktop className="text-lg" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullscreen?.();
            }}
            className="p-2 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white transition-all duration-300"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <FaCompress className="text-lg" /> : <FaExpand className="text-lg" />}
          </button>

          {/* Minimize Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize?.();
            }}
            className="p-2 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white transition-all duration-300"
            title="Minimize to sticky bar"
          >
            <FaChevronDown className="text-lg" />
          </button>
        </div>
      )}

      {/* Remote Video/Audio */}
      <div
        className="flex-1 relative min-h-0 overflow-hidden"
        onClick={handleVideoClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ cursor: videoZoom > 1 ? (isPanningRef.current ? 'grabbing' : 'grab') : 'pointer' }}
      >
        {/* Presentation Loading Overlay */}
        {presentationLoading && (
          <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center animate-fadeIn">
            <div className="relative">
              <UrbanSetuSpinner size="xl" isBright={false} />
              <FaDesktop className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-500 text-xl animate-pulse" />
            </div>
            <h3 className="mt-4 text-white text-xl font-medium tracking-wide">Starting presentation...</h3>
          </div>
        )}

        {/* Reconnecting Notification - Top Aligned */}
        {isReconnecting && (
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[110]" style={{ animation: 'slideDown 0.4s cubic-bezier(0.17, 0.67, 0.83, 0.67) forwards' }}>
            <div className="bg-gray-900/90 backdrop-blur-xl border border-white/20 px-6 py-2.5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 min-w-[320px]">
              <div className="relative flex items-center justify-center flex-shrink-0">
                 <UrbanSetuSpinner size="sm" />
                 <FaWifi className="absolute text-blue-400 text-[10px] animate-pulse" />
              </div>
              <div className="flex flex-col overflow-hidden">
                 <div className="flex items-center gap-2">
                   <span className="text-white text-sm font-bold tracking-tight">Reconnecting...</span>
                   <div className="flex gap-1">
                     <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                     <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                     <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                   </div>
                 </div>
                 <span className="text-gray-400 text-[11px] leading-tight truncate">
                    {reconnectReason === 'local-offline' 
                      ? "Network issue detected. Restoring call..."
                      : reconnectReason === 'remote-disconnected'
                      ? `Waiting for ${otherPartyName || 'Participant'} to return...`
                      : "Optimizing your connection..."}
                 </span>
              </div>
            </div>
          </div>
        )}

        {callType === 'video' ? (
          <>
            {/* Main video - Logic:
                1. If person is sharing: big window = screen share, small window = other party
                2. If remote is sharing: big window = screen share (from remote), small window = yourself
                3. Otherwise: normal layout */}
            {((isScreenSharing && screenShareStream) || remoteIsScreenSharing) ? (
              // Screen share in large view (either local or remote)
              <>
                <div
                  className="w-full h-full bg-black overflow-hidden relative"
                  style={{
                    transform: `scale(${videoZoom}) translate(${videoPanX}%, ${videoPanY}%)`,
                    transformOrigin: 'center center',
                    transition: isPanningRef.current ? 'none' : 'transform 0.1s ease-out'
                  }}
                >
                  {isScreenSharing && screenShareStream ? (
                    <video
                      key="screenshare-large-local"
                      ref={screenShareVideoRef}
                      srcObject={screenShareStream}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain max-w-full max-h-full"
                      onLoadedMetadata={(e) => {
                        e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing screen share:', err); });
                      }}
                    />
                  ) : (
                    <video
                      key="screenshare-large-remote"
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      muted={isRemoteAudioLocallyMuted}
                      className="w-full h-full object-contain max-w-full max-h-full"
                      onLoadedMetadata={(e) => {
                        e.target.muted = isRemoteAudioLocallyMuted;
                        e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing remote screen share:', err); });
                      }}
                    />
                  )}
                </div>
                {/* Screen share label - Responsive "Name - Presenting" */}
                <div className="absolute bottom-24 left-4 z-20">
                  <div className="bg-black bg-opacity-70 backdrop-blur-md rounded-full px-5 py-2.5 flex items-center gap-3 border border-white/10 shadow-lg transition-all hover:bg-opacity-80">
                    <div className={`p-1.5 rounded-full ${isScreenSharing ? 'bg-blue-500' : 'bg-purple-500'}`}>
                      <FaDesktop className="text-white text-xs" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold leading-tight">
                        {isScreenSharing ? 'You' : (otherPartyName || 'Caller')}
                      </span>
                      <span className="text-gray-300 text-[10px] font-medium uppercase tracking-wider leading-tight">
                        Presenting
                      </span>
                    </div>
                  </div>
                </div>
                {/* Zoom indicator - moved down to avoid overlap with mute indicator */}
                {videoZoom > 1 && (
                  <div className="absolute top-28 left-4 bg-black bg-opacity-70 rounded-full px-4 py-2 z-20">
                    <p className="text-white text-sm font-medium">{Math.round(videoZoom * 100)}%</p>
                  </div>
                )}
              </>
            ) : videoSwapped ? (
              // Local video in big view (when swapped)
              <>
                <div className="w-full h-full bg-black relative flex items-center justify-center">
                  <video
                    key="local-large"
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain max-w-full max-h-full"
                    style={{ transform: 'scaleX(-1)' }}
                    onLoadedMetadata={(e) => {
                      e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing local video:', err); });
                    }}
                  />
                </div>
                {!isVideoEnabled && (
                  <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center cursor-pointer">
                    <div className="text-center text-white">
                      <FaVideoSlash className="text-6xl mb-4 mx-auto opacity-50" />
                      <p className="text-xl">You</p>
                      <p className="text-sm text-gray-400 mt-2">Video is off</p>
                    </div>
                  </div>
                )}
                {/* Local video label in big view */}
                <div className="absolute bottom-24 left-4 bg-black bg-opacity-70 rounded-full px-4 py-2 z-20 flex items-center gap-2">
                  <p className="text-white text-sm font-medium">You</p>
                  {isLocalSpeaking && !isMuted && (
                    <div className="bg-green-500 rounded-full p-1 animate-pulse">
                      <FaVolumeUp className="text-white text-xs" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Remote video in big view (default) - camera video
              <>
                <div className="w-full h-full bg-black relative flex items-center justify-center">
                  <video
                    key="remote-large"
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={isRemoteAudioLocallyMuted}
                    className="w-full h-full object-contain max-w-full max-h-full"
                    onLoadedMetadata={(e) => {
                      e.target.muted = isRemoteAudioLocallyMuted; // Ensure audio respects local mute state
                      e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing remote video:', err); });
                    }}
                  />
                </div>
                {/* Remote video off indicator - only show when NOT screen sharing */}
                {!remoteVideoEnabled && !remoteIsScreenSharing && (
                  <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center cursor-pointer">
                    <div className="text-center text-white">
                      <FaVideoSlash className="text-6xl mb-4 mx-auto opacity-50" />
                      <p className="text-xl">{otherPartyName || 'Caller'}</p>
                      <p className="text-sm text-gray-400 mt-2">Video is off</p>
                    </div>
                  </div>
                )}
                {/* Remote video label - show name or fallback */}
                <div className="absolute bottom-24 left-4 bg-black bg-opacity-70 rounded-full px-4 py-2 z-20 flex items-center gap-2">
                  <p className="text-white text-sm font-medium">{otherPartyName || 'Caller'}</p>
                  {isRemoteSpeaking && !remoteIsMuted && (
                    <div className="bg-green-500 rounded-full p-1 animate-pulse">
                      <FaVolumeUp className="text-white text-xs" />
                    </div>
                  )}
                </div>
              </>
            )}
            {/* Remote mute indicator - moved down to top-16 to avoid overlapping with top-left controls */}
            {remoteIsMuted && (
              <div className="absolute top-16 left-4 bg-black bg-opacity-70 rounded-full px-4 py-2 flex items-center gap-2 z-20">
                <FaMicrophoneSlash className="text-white text-lg" />
                <span className="text-white text-sm">{otherPartyName || 'Caller'} is muted</span>
              </div>
            )}
            {/* Timer for video calls */}
            <div className="absolute top-4 right-4 bg-black bg-opacity-70 rounded-full px-4 py-2 z-20">
              <p className="text-white text-lg font-semibold">{formatDuration(callDuration)}</p>
            </div>
            {/* Camera switch button in large view when "You" video is swapped to large view */}
            {videoSwapped && availableCameras && availableCameras.length > 1 && (
              <div className="absolute top-4 right-24 z-30">
                <button
                  onClick={handleCameraToggle}
                  className="bg-black bg-opacity-70 hover:bg-opacity-90 rounded-full p-2 text-white transition-all active:scale-90"
                  title="Switch camera"
                >
                  <FaSync className={`text-sm ${isSwitchingCamera ? 'animate-[rotateSync_0.6s_ease-in-out]' : ''}`} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            {/* Hidden audio element for remote audio stream */}
            <audio
              ref={remoteAudioRef}
              autoPlay
              playsInline
              muted={isRemoteAudioLocallyMuted}
              className="hidden"
            />
            <div className="text-center text-white">
              {otherPartyData ? (
                <UserAvatar
                  user={{ username: otherPartyData.username, avatar: otherPartyData.avatar }}
                  size="w-32 h-32"
                  textSize="text-4xl"
                  showBorder={true}
                  className={`border-4 ${isRemoteSpeaking && !remoteIsMuted ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]' : 'border-white'} shadow-2xl mx-auto mb-4 transition-all duration-300`}
                />
              ) : (
                <div className={`w-32 h-32 bg-white bg-opacity-20 rounded-full mx-auto mb-4 flex items-center justify-center ${isRemoteSpeaking && !remoteIsMuted ? 'ring-4 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]' : ''} transition-all duration-300`}>
                  <FaPhone className="text-6xl" />
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mb-2">
                <h3 className="text-3xl font-bold">{otherPartyName || 'Loading...'}</h3>
                {isRemoteSpeaking && !remoteIsMuted && (
                  <div className="bg-green-500 rounded-full p-1.5 animate-pulse">
                    <FaVolumeUp className="text-white text-sm" />
                  </div>
                )}
              </div>
              <p className="text-xl">{formatDuration(callDuration)}</p>
              {/* Remote mute indicator for audio calls */}
              {remoteIsMuted && (
                <div className="mt-4 flex items-center justify-center gap-2 bg-black bg-opacity-50 rounded-full px-4 py-2">
                  <FaMicrophoneSlash className="text-white" />
                  <span className="text-sm">{otherPartyName || 'Caller'} is muted</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) - Shows remote when swapped, local when not swapped */}
        {callType === 'video' && (
          <div
            className={`absolute right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black z-20 cursor-pointer hover:border-blue-400 transition-all ${isDraggingPip ? 'scale-105 shadow-2xl opacity-90' : 'duration-300'
              } ${controlsVisible ? 'bottom-24' : 'bottom-6'}`}
            style={{
              transform: `translate(${pipPos.x}px, ${pipPos.y}px)`,
              cursor: isDraggingPip ? 'grabbing' : 'grab',
              touchAction: 'none'
            }}
            onClick={handleLocalVideoClick}
            onMouseDown={handlePipMouseDown}
            onTouchStart={handlePipMouseDown}
            title="Click to swap, drag to move"
          >
            {/* Small window logic:
                1. If person is sharing: show remote (other party) in small window
                2. If remote is sharing: show local (yourself) in small window  
                3. Otherwise: normal swap logic */}
            {(isScreenSharing || remoteIsScreenSharing) ? (
              // During screen share, show other party in small window
              isScreenSharing ? (
                // Person is sharing: show remote (other party) in small window
                <>
                  <video
                    key="remote-small-screenshare"
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={isRemoteAudioLocallyMuted}
                    className="w-full h-full object-cover"
                    onLoadedMetadata={(e) => {
                      e.target.muted = isRemoteAudioLocallyMuted;
                      e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing remote video:', err); });
                    }}
                  />
                  {!remoteVideoEnabled && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <FaVideoSlash className="text-white text-xl" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 rounded-full px-3 py-1 flex items-center gap-1">
                    <p className="text-white text-xs font-medium">{otherPartyName || 'Caller'}</p>
                    {isRemoteSpeaking && !remoteIsMuted && (
                      <div className="bg-green-500 rounded-full p-0.5 animate-pulse">
                        <FaVolumeUp className="text-white text-[8px]" />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // Remote is sharing: show Local User (You) in small window
                // Since we use track replacement for screen sharing, we don't receive the presenter's camera feed.
                // So we show the local user instead to avoid duplicating the presentation view.
                <>
                  <video
                    key="local-small-during-remote-share"
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                    onLoadedMetadata={(e) => {
                      e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing local video:', err); });
                    }}
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <FaVideoSlash className="text-white text-xl" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 rounded-full px-3 py-1 flex items-center gap-1">
                    <p className="text-white text-xs font-medium">You</p>
                    {isLocalSpeaking && !isMuted && (
                      <div className="bg-green-500 rounded-full p-0.5 animate-pulse">
                        <FaVolumeUp className="text-white text-[8px]" />
                      </div>
                    )}
                  </div>
                </>
              )
            ) : videoSwapped ? (
              // Remote video in mini view (when swapped, no screen share)
              <>
                <video
                  key="remote-small"
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={isRemoteAudioLocallyMuted}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(e) => {
                    e.target.muted = isRemoteAudioLocallyMuted;
                    e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing remote video:', err); });
                  }}
                />
                {!remoteVideoEnabled && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <FaVideoSlash className="text-white text-xl" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 rounded-full px-3 py-1 flex items-center gap-1">
                  <p className="text-white text-xs font-medium">{otherPartyName || 'Caller'}</p>
                  {isRemoteSpeaking && !remoteIsMuted && (
                    <div className="bg-green-500 rounded-full p-0.5 animate-pulse">
                      <FaVolumeUp className="text-white text-[8px]" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Local video in mini view (default, no screen share)
              <>
                <video
                  key="local-small"
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                  onLoadedMetadata={(e) => {
                    e.target.play().catch(err => { if (err.name !== 'AbortError') console.error('Error playing local video:', err); });
                  }}
                />
                {!isVideoEnabled && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <FaVideoSlash className="text-white text-xl" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 rounded-full px-3 py-1 flex items-center gap-1">
                  <p className="text-white text-xs font-medium">You</p>
                  {isLocalSpeaking && !isMuted && (
                    <div className="bg-green-500 rounded-full p-0.5 animate-pulse">
                      <FaVolumeUp className="text-white text-[8px]" />
                    </div>
                  )}
                </div>
              </>
            )}
            {/* Camera switch button (only show on local video in small view) */}
            {/* Camera switch button (only show on local video in small view) */}
            {!videoSwapped && availableCameras && availableCameras.length > 1 && (
              <div className="absolute top-2 right-2 z-30">
                <button
                  onClick={handleCameraToggle}
                  className="bg-black bg-opacity-70 hover:bg-opacity-90 rounded-full p-2 text-white transition-all active:scale-90"
                  title="Switch camera"
                >
                  <FaSync className={`text-sm ${isSwitchingCamera ? 'animate-[rotateSync_0.6s_ease-in-out]' : ''}`} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div
        className={`bg-black/60 backdrop-blur-md p-4 sm:p-6 transition-opacity duration-300 ${callType === 'video' && !controlsVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        style={{ animation: 'slideIn 0.4s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          {/* Combined Audio Controls (Mute Remote + Audio Options) */}
          <div className="relative">
            <div className={`flex items-center rounded-full shadow-2xl hover:scale-105 transition-transform duration-300 ${isRemoteAudioLocallyMuted ? 'bg-red-500' : 'bg-gray-800/80 ring-1 ring-white/10'}`}>
              <button
                onClick={() => setIsRemoteAudioLocallyMuted(!isRemoteAudioLocallyMuted)}
                className={`h-10 sm:h-12 flex items-center justify-center ${((availableMicrophones && availableMicrophones.length > 1) || (availableSpeakers && availableSpeakers.length > 1)) ? 'w-8 sm:w-10 rounded-l-full pl-1 sm:pl-2' : 'w-10 sm:w-12 rounded-full'} hover:bg-white/10 text-white transition-colors`}
                title={isRemoteAudioLocallyMuted ? 'Unmute Remote Audio' : 'Mute Remote Audio'}
              >
                {isRemoteAudioLocallyMuted ? <FaVolumeMute className="text-lg sm:text-xl" /> : <FaVolumeUp className="text-lg sm:text-xl" />}
              </button>

              {((availableMicrophones && availableMicrophones.length > 1) || (supportsSetSinkId && availableSpeakers && availableSpeakers.length > 1)) && (
                <>
                  <div className="w-[1px] h-5 sm:h-6 bg-white/20"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAudioMenu(!showAudioMenu);
                    }}
                    className="w-7 sm:w-8 h-10 sm:h-12 flex items-center justify-center rounded-r-full hover:bg-white/10 text-white transition-colors"
                    title="Audio options"
                  >
                    <FaChevronDown size={8} className="sm:size-[10px]" />
                  </button>
                </>
              )}
            </div>

            {/* Audio Device Menu Dropdown */}
            {showAudioMenu && (
              <div className="fixed sm:absolute bottom-28 sm:bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-[calc(100vw-2rem)] sm:min-w-[260px] sm:max-w-[320px] z-50 border border-white/10 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 ring-1 ring-black/5">
                <div className="py-2">
                  {/* Microphones */}
                  {availableMicrophones && availableMicrophones.length > 1 && (
                    <>
                      <div className="px-3 py-2 border-b border-white border-opacity-10">
                        <p className="text-xs font-semibold text-white text-opacity-80 uppercase tracking-wide">Microphone</p>
                      </div>
                      {availableMicrophones.map((mic) => (
                        <button
                          key={mic.deviceId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwitchMicrophone?.(mic.deviceId);
                            setShowAudioMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white hover:bg-opacity-20 transition-colors ${currentMicrophoneId === mic.deviceId ? 'bg-white bg-opacity-20 font-medium' : ''
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            {currentMicrophoneId === mic.deviceId && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <span className={currentMicrophoneId === mic.deviceId ? '' : 'pl-4'}>
                              {mic.label || `Microphone ${mic.deviceId.substring(0, 8)}`}
                            </span>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Speakers - Only show if supported */}
                  {supportsSetSinkId && availableSpeakers && availableSpeakers.length > 1 && (
                    <>
                      <div className="px-3 py-2 border-t border-b border-white border-opacity-10 mt-1">
                        <p className="text-xs font-semibold text-white text-opacity-80 uppercase tracking-wide">Speaker</p>
                      </div>
                      {availableSpeakers.map((speaker) => (
                        <button
                          key={speaker.deviceId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwitchSpeaker?.(speaker.deviceId);
                            setShowAudioMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white hover:bg-opacity-20 transition-colors ${currentSpeakerId === speaker.deviceId ? 'bg-white bg-opacity-20 font-medium' : ''
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            {currentSpeakerId === speaker.deviceId && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <span className={currentSpeakerId === speaker.deviceId ? '' : 'pl-4'}>
                              {speaker.label || `Speaker ${speaker.deviceId.substring(0, 8)}`}
                            </span>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mute/Unmute */}
          <button
            onClick={onToggleMute}
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
              } text-white shadow-2xl hover:scale-110 active:scale-90 transform ring-1 ring-white/10`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <FaMicrophoneSlash className="text-xl sm:text-2xl" /> : <FaMicrophone className="text-xl sm:text-2xl" />}
          </button>

          {/* Video On/Off (only for video calls) */}
          {callType === 'video' && (
            <button
              onClick={onToggleVideo}
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${isVideoEnabled ? 'bg-gray-800 hover:bg-gray-700' : 'bg-red-500 hover:bg-red-600'
                } text-white shadow-2xl hover:scale-110 active:scale-90 transform ring-1 ring-white/10`}
              title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
            >
              {isVideoEnabled ? <FaVideo className="text-xl sm:text-2xl" /> : <FaVideoSlash className="text-xl sm:text-2xl" />}
            </button>
          )}

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-12 h-12 sm:w-16 sm:h-16 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-all duration-300 shadow-2xl hover:scale-110 active:scale-90 transform ring-1 ring-white/10"
            title="End Call"
          >
            <FaPhone className="text-xl sm:text-2xl rotate-[135deg]" />
          </button>
        </div>
      </div>

      {/* Call Summary Overlay - Shows when callState is 'ended' */}
      {callState === 'ended' && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-95 z-[60] flex items-center justify-center animate-[fadeIn_0.4s_ease-out]">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl transform animate-[popIn_0.5s_ease-out] relative">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-[popIn_0.6s_ease-out_delay-100ms]">
                <FaCheckCircle className="text-4xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Call Session Summary</h2>
              <p className="text-gray-500">Your conversation has concluded</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    {callType === 'video' ? <FaVideo /> : <FaPhone />}
                  </div>
                  <span className="text-gray-600 font-medium">Call Type</span>
                </div>
                <span className="text-gray-900 font-bold capitalize text-right flex-shrink-0">{callType}</span>
              </div>

              <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <FaUser />
                  </div>
                  <span className="text-gray-600 font-medium">Participant</span>
                </div>
                <span 
                  className="text-gray-900 font-bold text-right truncate min-w-0 flex-1 ml-2" 
                  title={otherPartyName || 'Other Person'}
                >
                  {otherPartyName || 'Other Person'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                    <FaClock />
                  </div>
                  <span className="text-gray-600 font-medium">Duration</span>
                </div>
                <span className="text-gray-900 font-bold text-right flex-shrink-0">
                  {isSyncingSummary ? (
                    <span className="flex items-center gap-2 text-blue-600 animate-pulse">
                      <FaSync className="animate-spin text-xs" />
                      Syncing...
                    </span>
                  ) : (
                    formatDuration(callDuration)
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (!isSyncingSummary) onEndCall();
              }}
              disabled={isSyncingSummary}
              className={`w-full font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg ${isSyncingSummary
                  ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                }`}
            >
              {isSyncingSummary ? 'Syncing final details...' : 'Close Summary'}
            </button>
          </div>
        </div>
      )}
    </div>

  );
};

export default ActiveCallModal;