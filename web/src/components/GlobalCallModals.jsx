import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useCallContext } from '../contexts/CallContext';
import IncomingCallModal from './IncomingCallModal';
import ActiveCallModal from './ActiveCallModal';
import OngoingCallBar from './OngoingCallBar';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Component to fetch appointment data for displaying names
const GlobalCallModals = () => {
  const {
    callState,
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    containerRef,
    isMuted,
    isVideoEnabled,
    remoteIsMuted,
    remoteVideoEnabled,
    callDuration,
    availableCameras,
    currentCameraId,
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
    isSyncingSummary,
    isReconnecting,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleScreenShare,
    toggleFullscreen,
    switchMicrophone,
    switchSpeaker,
    enumerateCameras,
    isMinimized,
    setIsMinimized
  } = useCallContext();

  const { currentUser } = useSelector((state) => state.user);
  const [appointmentData, setAppointmentData] = useState(null);
  const [loadingAppointment, setLoadingAppointment] = useState(false);

  // Fetch appointment data when active call or incoming call changes
  useEffect(() => {
    const fetchAppointment = async () => {
      const appointmentId = activeCall?.appointmentId || incomingCall?.appointmentId;
      
      if (appointmentId) {
        // Only fetch if we don't have data for this appointment
        if (appointmentData?._id !== appointmentId) {
          setLoadingAppointment(true);
          try {
            const response = await axios.get(
              `${API_BASE_URL}/api/bookings/${appointmentId}`,
              { withCredentials: true }
            );
            if (response.data.success) {
              setAppointmentData(response.data.booking);
            }
          } catch (error) {
            console.error('Error fetching appointment:', error);
          } finally {
            setLoadingAppointment(false);
          }
        }
      } else {
        setAppointmentData(null);
      }
    };

    fetchAppointment();
  }, [activeCall?.appointmentId, incomingCall?.appointmentId]);

  // Get other party name and data for active call
  const getOtherPartyName = () => {
    // For receiver: use callerName from incomingCall as immediate fallback
    if (incomingCall?.callerName && !appointmentData) {
      return incomingCall.callerName;
    }
    
    if (!appointmentData || !currentUser) {
      // Return callerName from incomingCall if available
      return incomingCall?.callerName || null;
    }
    
    // Handle both string and ObjectId comparisons
    const currentUserId = currentUser._id?.toString() || currentUser._id;
    const buyerId = appointmentData.buyerId?._id?.toString() || appointmentData.buyerId?.toString() || appointmentData.buyerId;
    const sellerId = appointmentData.sellerId?._id?.toString() || appointmentData.sellerId?.toString() || appointmentData.sellerId;
    
    if (buyerId === currentUserId) {
      return appointmentData.sellerId?.username || incomingCall?.callerName || null;
    }
    if (sellerId === currentUserId) {
      return appointmentData.buyerId?.username || incomingCall?.callerName || null;
    }
    
    // Fallback to incomingCall callerName
    return incomingCall?.callerName || null;
  };

  const getOtherPartyData = () => {
    if (!appointmentData || !currentUser) return null;
    
    // Handle both string and ObjectId comparisons
    const currentUserId = currentUser._id?.toString() || currentUser._id;
    const buyerId = appointmentData.buyerId?._id?.toString() || appointmentData.buyerId?.toString() || appointmentData.buyerId;
    const sellerId = appointmentData.sellerId?._id?.toString() || appointmentData.sellerId?.toString() || appointmentData.sellerId;
    
    if (buyerId === currentUserId) {
      return appointmentData.sellerId || null;
    }
    if (sellerId === currentUserId) {
      return appointmentData.buyerId || null;
    }
    
    return null;
  };

  return (
    <>
      {/* Incoming Call Modal - Shows on any page */}
      <IncomingCallModal
        call={incomingCall}
        onAccept={acceptCall}
        onReject={rejectCall}
      />

      {/* Active Call Modal - Only shows when not minimized */}
      {(callState === 'active' || callState === 'ended') && activeCall && !isMinimized && (
        <ActiveCallModal
          callState={callState}
          callType={activeCall.callType}
          otherPartyName={getOtherPartyName()}
          otherPartyData={getOtherPartyData()}
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          remoteIsMuted={remoteIsMuted}
          remoteVideoEnabled={remoteVideoEnabled}
          callDuration={callDuration}
          isSyncingSummary={isSyncingSummary}
          isReconnecting={isReconnecting}
          localStream={localStream}
          remoteStream={remoteStream}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          remoteAudioRef={remoteAudioRef}
          containerRef={containerRef}
          availableCameras={availableCameras}
          currentCameraId={currentCameraId}
          isScreenSharing={isScreenSharing}
          remoteIsScreenSharing={remoteIsScreenSharing}
          cameraStreamDuringScreenShare={cameraStreamDuringScreenShare}
          screenShareStream={screenShareStream}
          isFullscreen={isFullscreen}
          connectionQuality={connectionQuality}
          availableMicrophones={availableMicrophones}
          availableSpeakers={availableSpeakers}
          currentMicrophoneId={currentMicrophoneId}
          currentSpeakerId={currentSpeakerId}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
          onSwitchCamera={switchCamera}
          onToggleScreenShare={toggleScreenShare}
          onToggleFullscreen={toggleFullscreen}
          onSwitchMicrophone={switchMicrophone}
          onSwitchSpeaker={switchSpeaker}
          onMinimize={() => setIsMinimized(true)}
        />
      )}

      {/* Sticky Bar for ongoing/ringing calls when minimized */}
      {(callState === 'active' || callState === 'ringing') && isMinimized && (
        <OngoingCallBar
          otherPartyName={getOtherPartyName() || 'Participant'}
          callType={activeCall?.callType || incomingCall?.callType || 'audio'}
          callDuration={callDuration}
          onReturn={() => setIsMinimized(false)}
          onEndCall={endCall}
          isReconnecting={isReconnecting}
        />
      )}

      {/* Waiting Screen for Caller - Shows when ringing AND NOT minimized */}
      {callState === 'ringing' && activeCall && !isMinimized && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[9998]">
          <div className="text-center text-white animate-fade-in flex-1 flex flex-col items-center justify-center">
            <div className={`w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center ${
              activeCall.callType === 'video' ? 'bg-blue-500' : 'bg-green-500'
            } animate-pulse shadow-2xl`}>
              {activeCall.callType === 'video' ? (
                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              ) : (
                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              )}
            </div>
            <h3 className="text-3xl font-bold mb-2 animate-pulse">Calling...</h3>
            <p className="text-xl text-gray-300 mb-4">
              {appointmentData ? getOtherPartyName() : 'Waiting for answer'}
            </p>
            <div className="mt-8 flex justify-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
          {/* End Call Button */}
          <div className="pb-8 flex justify-center">
            <button
              onClick={endCall}
              className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-300 shadow-xl hover:scale-110 active:scale-95 transform"
              title="End Call"
            >
              <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalCallModals;

