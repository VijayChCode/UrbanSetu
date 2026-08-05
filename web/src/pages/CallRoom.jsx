import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCallContext } from '../contexts/CallContext';
import { authenticatedFetch } from '../utils/auth';
import { API_BASE_URL } from '../config/api';
import { FaPhone, FaVideo, FaMicrophone, FaMicrophoneSlash, FaVideoSlash, FaArrowLeft, FaExclamationTriangle, FaClock } from 'react-icons/fa';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { toast } from 'react-toastify';

export default function CallRoom() {
  const { token } = useParams();
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
  const localVideoRef = useRef(null);

  // Attach local stream to video ref if available during preview
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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
            startLinkCallWaiting(
              data.callId,
              token,
              data.callType,
              data.appointmentId,
              data.receiverId
            ).catch((err) => {
              console.error('Failed to start waiting stream:', err);
            });
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
    } catch (err) {
      console.error('Failed to join call:', err);
      toast.error('Failed to join call. Please check device permissions.');
      setJoining(false);
    }
  };

  const handleBackToAppointments = () => {
    if (callState === 'link-waiting' || callState === 'link-joining' || callState === 'active') {
      endCall();
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <button
          onClick={handleBackToAppointments}
          className="p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 rounded-xl text-slate-300 transition-all flex items-center gap-2"
        >
          <FaArrowLeft /> <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      {/* Main Room Card */}
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center relative z-10">
        {/* Call Type Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold uppercase tracking-wider text-teal-400 mb-6">
          {callData?.callType === 'video' ? <FaVideo /> : <FaPhone />}
          <span>{callData?.callType === 'video' ? 'Video Call Room' : 'Audio Call Room'}</span>
        </div>

        {/* Appointment / Property Info */}
        {callData?.propertyName && (
          <h3 className="text-sm font-medium text-slate-400 mb-1">
            Property: <span className="text-slate-200">{callData.propertyName}</span>
          </h3>
        )}

        <h1 className="text-2xl font-bold text-slate-100 mb-6">
          {isCaller ? `Calling ${callData?.receiverName}` : `Call with ${callData?.callerName}`}
        </h1>

        {/* Local Preview Box */}
        <div className="w-full aspect-video bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative mb-6 shadow-inner flex items-center justify-center">
          {callData?.callType === 'video' && isVideoEnabled && localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-2xl font-bold text-teal-400 border border-slate-700 mb-3 shadow-md">
                {(isCaller ? currentUser?.username : callData?.callerName)?.[0]?.toUpperCase() || 'U'}
              </div>
              <p className="text-xs text-slate-400">
                {callData?.callType === 'video' ? 'Camera is off' : 'Audio Call Preview'}
              </p>
            </div>
          )}

          {/* Status Overlay */}
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1 rounded-full text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {isCaller ? 'Waiting for participant...' : isCallActive ? 'Connected' : 'Ready to join'}
          </div>
        </div>

        {/* Media Toggle Controls (Pre-call) */}
        {localStream && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full border transition-all ${
                isMuted
                  ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <FaMicrophoneSlash className="text-xl" /> : <FaMicrophone className="text-xl" />}
            </button>

            {callData?.callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full border transition-all ${
                  !isVideoEnabled
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
                title={!isVideoEnabled ? 'Turn On Camera' : 'Turn Off Camera'}
              >
                {!isVideoEnabled ? <FaVideoSlash className="text-xl" /> : <FaVideo className="text-xl" />}
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {isCaller ? (
          <div className="w-full space-y-3">
            <div className="flex items-center justify-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2.5 px-4 rounded-xl text-sm font-medium">
              <FaClock className="animate-spin" />
              <span>Share the link or wait in chat for them to join</span>
            </div>

            <button
              onClick={handleBackToAppointments}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <FaPhone className="rotate-[135deg]" /> End & Leave Room
            </button>
          </div>
        ) : (
          <div className="w-full space-y-3">
            <button
              onClick={handleJoinCall}
              disabled={joining || isCallActive}
              className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-teal-500/25 flex items-center justify-center gap-3 text-lg"
            >
              {joining ? (
                <>
                  <UrbanSetuSpinner size="sm" isBright /> Connecting...
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
  );
}
