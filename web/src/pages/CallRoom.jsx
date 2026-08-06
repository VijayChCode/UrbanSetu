import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCallContext } from '../contexts/CallContext';
import { authenticatedFetch } from '../utils/auth';
import { API_BASE_URL } from '../config/api';
import { FaPhone, FaVideo, FaMicrophone, FaMicrophoneSlash, FaVideoSlash, FaArrowLeft, FaExclamationTriangle, FaClock, FaCheckCircle } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { toast } from 'react-toastify';
import { usePageTitle } from '../hooks/usePageTitle';
import MediaPermissionModal from '../components/MediaPermissionModal';
import MicLevelBar from '../components/MicLevelBar';
import { socket } from '../utils/socket';

export default function CallRoom() {
  const params = useParams();
  const location = useLocation();
  const token = params.token;
  const routeCallType = params.type || (location.pathname.includes('/call/video') ? 'video' : location.pathname.includes('/call/audio') ? 'audio' : null);
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);

  const {
    callState,
    activeCall,
    startLinkCallWaiting,
    joinCallViaLink,
    endCall,
    localStream,
    isMuted,
    isVideoEnabled,
    toggleMute,
    toggleVideo
  } = useCallContext();

  const [loading, setLoading] = useState(true);
  const [callData, setCallData] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [participantJoined, setParticipantJoined] = useState(false);
  const [callerInRoom, setCallerInRoom] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionType, setPermissionType] = useState('video');
  const localVideoRef = useRef(null);

  // Dynamic page title
  const isVideoCall = (callData?.callType || routeCallType) === 'video';
  const callTypeLabel = isVideoCall ? 'Video Call' : 'Audio Call';
  const otherPartyName = callData ? (callData.isCaller ? callData.receiverName : callData.callerName) : '';
  const pageTitle = otherPartyName 
    ? `${callTypeLabel} with ${otherPartyName}` 
    : `${callTypeLabel} Room`;
  usePageTitle(pageTitle);

  // Attach local stream to video ref if available during preview (and on video toggle)
  useEffect(() => {
    if (localVideoRef.current && localStream && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoEnabled]);

  // Auto-reset joining state and sync presence state on callState transition
  useEffect(() => {
    if (callState === 'active' || callState === 'ended' || !callState) {
      setJoining(false);
    }
    if (callState === 'active') {
      setParticipantJoined(true);
      setCallerInRoom(true);
    }
  }, [callState]);

  // Sync initial callerInRoom from callData
  useEffect(() => {
    if (callData?.isCaller) {
      setCallerInRoom(true);
    } else if (callData) {
      setCallerInRoom(!!(callData.isCallerWaiting || callData.callerInRoom || callData.status === 'waiting'));
    }
  }, [callData]);

  // Listen for presence / joined events
  useEffect(() => {
    if (!socket || !callData?.callId) return;

    // Joiner announces presence to room (identifying as non-caller)
    if (!callData.isCaller) {
      socket.emit('call-link-presence', { callId: callData.callId, token, isCaller: false });
    }

    const handleParticipantJoined = (data) => {
      if (data?.callId === callData?.callId || data?.token === token) {
        console.log('[CallRoom] Participant joined event:', data);
        if (callData.isCaller) {
          setParticipantJoined(true);
        } else {
          setCallerInRoom(true);
        }
      }
    };

    const handleCallerWaiting = (data) => {
      if (data?.callId === callData?.callId || data?.token === token) {
        console.log('[CallRoom] Caller waiting event:', data);
        if (!callData.isCaller) {
          setCallerInRoom(true);
        }
      }
    };

    const handlePresence = (data) => {
      if (data?.callId === callData?.callId || data?.token === token) {
        console.log('[CallRoom] Presence event:', data);
        if (callData.isCaller) {
          setParticipantJoined(true);
        } else if (data?.isCaller) {
          setCallerInRoom(true);
        }
      }
    };

    socket.on('call-link-joined', handleParticipantJoined);
    socket.on('call-link-waiting', handleCallerWaiting);
    socket.on('call-link-presence', handlePresence);

    return () => {
      socket.off('call-link-joined', handleParticipantJoined);
      socket.off('call-link-waiting', handleCallerWaiting);
      socket.off('call-link-presence', handlePresence);
    };
  }, [callData, token]);

  // Validate token on mount
  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        setError('No call token provided.');
        setLoading(false);
        return;
      }

      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/link/${token}`);
        const data = await response.json();

        if (!isMounted) return;

        if (response.ok && data.valid) {
          setCallData(data);
          // If the user is the caller and we're not yet in a call state, auto-start waiting
          if (data.isCaller && !callState) {
            try {
              await startLinkCallWaiting(
                data.callId,
                token,
                data.callType,
                data.appointmentId,
                data.receiverId
              );
            } catch (err) {
              console.error('Failed to start waiting stream:', err);
              if (err?.isPermissionDenied || err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                setPermissionType(data.callType === 'video' ? 'video' : 'microphone');
                setShowPermissionModal(true);
              }
            }
          } else if (!data.isCaller && !localStream) {
            // For Joiner (Receiver): Acquire media preview on mount to verify permissions & show preview
            try {
              const constraints = {
                audio: true,
                video: data.callType === 'video'
              };
              const stream = await navigator.mediaDevices.getUserMedia(constraints);
              if (isMounted) {
                // Apply pre-call preferences
                if (isMuted) {
                  stream.getAudioTracks().forEach(t => { t.enabled = false; });
                }
                if (!isVideoEnabled && data.callType === 'video') {
                  stream.getVideoTracks().forEach(t => { t.enabled = false; });
                }
                setLocalStream(stream);
                setShowPermissionModal(false);
              } else {
                stream.getTracks().forEach(t => t.stop());
              }
            } catch (mediaErr) {
              console.warn('[CallRoom] Joiner media preview access error:', mediaErr);
              if (isMounted && (mediaErr?.name === 'NotAllowedError' || mediaErr?.name === 'PermissionDeniedError' || mediaErr?.isPermissionDenied)) {
                setPermissionType(data.callType === 'video' ? 'video' : 'microphone');
                setShowPermissionModal(true);
              }
            }
          }
        } else {
          setError(data.message || 'Invalid or expired call link.');
        }
      } catch (err) {
        console.error('Error validating call link:', err);
        if (isMounted) {
          setError('Failed to load call room. Please check your connection.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Add beforeunload event listener to prompt user if they try to close/reload during an active/waiting call
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (callState === 'link-waiting' || callState === 'link-joining' || callState === 'active') {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave the call room?';
        return 'Are you sure you want to leave the call room?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [callState]);

  // Ensure media tracks are stopped when navigating away or unmounting CallRoom
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
    };
  }, [localStream]);

  const checkAndRetryMedia = async () => {
    if (!callData) return;
    try {
      const constraints = {
        audio: true,
        video: callData.callType === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (isMuted) {
        stream.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      if (!isVideoEnabled && callData.callType === 'video') {
        stream.getVideoTracks().forEach(t => { t.enabled = false; });
      }
      setLocalStream(stream);
      setShowPermissionModal(false);
      toast.success('Media permissions granted!');
    } catch (err) {
      console.warn('[CallRoom] Retry media stream failed:', err);
      setPermissionType(callData.callType === 'video' ? 'video' : 'microphone');
      setShowPermissionModal(true);
    }
  };

  // Handle Join button click for the receiver
  const handleJoinCall = async () => {
    if (!callData) return;
    setJoining(true);
    try {
      await joinCallViaLink(
        callData.callId,
        token,
        callData.callType,
        callData.appointmentId,
        callData.callerId
      );
      setJoining(false);
    } catch (err) {
      console.error('Failed to join call:', err);
      setJoining(false);
      if (err?.isPermissionDenied || err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionType(callData.callType === 'video' ? 'video' : 'microphone');
        setShowPermissionModal(true);
      } else {
        toast.error('Failed to join call. Please check device permissions.');
      }
    }
  };

  const handleBackToAppointments = async () => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setLocalStream(null);
    }
    if (callState === 'link-waiting' || callState === 'link-joining' || callState === 'active') {
      await endCall();
    }
    navigate('/user/my-appointments');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <UrbanSetuSpinner size="lg" />
        <p className="mt-4 text-slate-400 font-medium">Validating call room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Unable to Join Call</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={handleBackToAppointments}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <FaArrowLeft /> Return to Appointments
          </button>
        </div>
      </div>
    );
  }

  const isCaller = callData?.isCaller;
  const isCallActive = callState === 'active';

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-x-hidden overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-72 sm:w-96 h-72 sm:h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-72 sm:w-96 h-72 sm:h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Outer Container with Top Header */}
      <div className="w-full max-w-lg flex flex-col items-center relative z-10 my-auto">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between mb-3 sm:mb-4 px-1">
          <button
            onClick={handleBackToAppointments}
            className="py-2 px-3 sm:py-2.5 sm:px-4 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 rounded-xl text-slate-300 transition-all flex items-center gap-2 text-xs sm:text-sm font-medium shadow-md active:scale-95"
          >
            <FaArrowLeft /> <span>Back to Appointments</span>
          </button>
        </div>

        {/* Main Room Card */}
        <div className="w-full bg-slate-900/95 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
          {/* Call Type Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/80 border border-slate-700/70 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-teal-400 mb-4 sm:mb-6">
            {callData?.callType === 'video' ? <FaVideo /> : <FaPhone />}
            <span>{callData?.callType === 'video' ? 'Video Call Room' : 'Audio Call Room'}</span>
          </div>

          {/* Appointment / Property Info */}
          {callData?.propertyName && (
            <h3 className="text-xs sm:text-sm font-medium text-slate-400 mb-1 truncate max-w-full px-2">
              Property: <span className="text-slate-200 font-semibold">{callData.propertyName}</span>
            </h3>
          )}

          <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mb-4 sm:mb-6 px-2 break-words">
            {isCaller ? `Calling ${callData?.receiverName}` : `Call with ${callData?.callerName}`}
          </h1>

          {/* Local Preview Box */}
          <div className="w-full aspect-video bg-slate-950 rounded-xl sm:rounded-2xl border border-slate-800/80 overflow-hidden relative mb-4 sm:mb-6 shadow-inner flex items-center justify-center">
            {callData?.callType === 'video' && isVideoEnabled && localStream ? (
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  if (el && localStream && el.srcObject !== localStream) {
                    el.srcObject = localStream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 p-4">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-teal-400 border border-slate-700 mb-2 sm:mb-3 shadow-md">
                  {(isCaller ? currentUser?.username : callData?.callerName)?.[0]?.toUpperCase() || 'U'}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  {callData?.callType === 'video' ? 'Camera is off' : 'Audio Call Preview'}
                </p>
              </div>
            )}

            {/* Mic level bar overlay */}
            {localStream && (
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/70 px-2.5 py-1 rounded-full text-[10px] sm:text-xs text-slate-300 flex items-center gap-1.5 shadow-sm">
                <FaMicrophone className={isMuted ? "text-red-400" : "text-teal-400"} />
                <MicLevelBar stream={localStream} barCount={5} height="16px" theme="dark" muted={isMuted} />
              </div>
            )}

            {/* Status Overlay */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/70 px-2.5 py-1 rounded-full text-[10px] sm:text-xs text-slate-300 flex items-center gap-1.5 shadow-sm">
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                isCallActive || (isCaller ? participantJoined : callerInRoom) ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              <span>
                {isCallActive
                  ? 'Connected'
                  : isCaller
                    ? participantJoined
                      ? `${callData?.receiverName || 'Participant'} joined — Connecting...`
                      : `Waiting for ${callData?.receiverName || 'participant'}...`
                    : joining || callState === 'link-joining'
                      ? `Connecting to ${callData?.callerName || 'caller'}...`
                      : callerInRoom
                        ? `${callData?.callerName || 'Caller'} is waiting in room`
                        : `Waiting for ${callData?.callerName || 'caller'} to enter room...`}
              </span>
            </div>
          </div>

          {/* Media Toggle Controls (Pre-call) */}
          {localStream ? (
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                onClick={toggleMute}
                className={`p-3 sm:p-4 rounded-full border transition-all active:scale-95 ${
                  isMuted
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <FaMicrophoneSlash className="text-lg sm:text-xl" /> : <FaMicrophone className="text-lg sm:text-xl" />}
              </button>

              {callData?.callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={`p-3 sm:p-4 rounded-full border transition-all active:scale-95 ${
                    !isVideoEnabled
                      ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={!isVideoEnabled ? 'Turn On Camera' : 'Turn Off Camera'}
                >
                  {!isVideoEnabled ? <FaVideoSlash className="text-lg sm:text-xl" /> : <FaVideo className="text-lg sm:text-xl" />}
                </button>
              )}
            </div>
          ) : (
            <div className="flex justify-center mb-6 sm:mb-8">
              <button
                onClick={checkAndRetryMedia}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
              >
                <FaExclamationTriangle className="text-amber-400" />
                <span>Media permission required — click to enable/grant</span>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          {isCaller ? (
            <div className="w-full space-y-3">
              <div className={`flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                participantJoined || isCallActive
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
              }`}>
                {participantJoined || isCallActive ? (
                  <>
                    <FaCheckCircle className="text-emerald-400 flex-shrink-0 animate-bounce" />
                    <span>{callData?.receiverName || 'Participant'} has joined! Establishing connection...</span>
                  </>
                ) : (
                  <>
                    <FaClock className="animate-spin flex-shrink-0" />
                    <span>Share the link or wait in chat for them to join</span>
                  </>
                )}
              </div>

              <button
                onClick={handleBackToAppointments}
                className="w-full py-3 sm:py-3.5 bg-red-600 hover:bg-red-500 text-white text-sm sm:text-base font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-98"
              >
                <FaPhone className="rotate-[135deg]" /> End & Leave Room
              </button>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {!callerInRoom && !isCallActive && (
                <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 mb-2">
                  <FaClock className="animate-spin flex-shrink-0" />
                  <span>Waiting for {callData?.callerName || 'host'} to enter the room...</span>
                </div>
              )}

              <button
                onClick={handleJoinCall}
                disabled={joining || isCallActive || !callerInRoom}
                className={`w-full py-3.5 sm:py-4 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg active:scale-98 ${
                  !callerInRoom && !isCallActive
                    ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed shadow-none'
                    : 'bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white hover:shadow-teal-500/25'
                }`}
              >
                {joining ? (
                  <>
                    <UrbanSetuSpinner size="sm" isBright /> Connecting...
                  </>
                ) : !callerInRoom && !isCallActive ? (
                  <>
                    <FaClock className="animate-spin text-amber-400" /> Waiting for Host to Enter...
                  </>
                ) : (
                  <>
                    {callData?.callType === 'video' ? <FaVideo /> : <FaPhone />} Join Call Now
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Permission Modal */}
      <MediaPermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        permissionType={permissionType}
        actionText="join call"
      />
    </div>
  );
}
