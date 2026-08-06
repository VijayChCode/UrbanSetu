import { useState, useRef, useEffect, useCallback } from 'react';
import { socket, reconnectSocket } from '../utils/socket';
import SimplePeer from 'simple-peer';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';
import { getAuthToken } from '../utils/auth';
import { useSoundEffects } from '../components/SoundEffects';

// STUN servers for WebRTC
// Default STUN servers as fallback
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

import { authenticatedFetch } from '../utils/csrf';

// Helper to fetch TURN credentials securely
const fetchIceServers = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/turn-credentials`);

    if (response.ok) {
      const data = await response.json();
      return data.iceServers || DEFAULT_ICE_SERVERS;
    }
    return DEFAULT_ICE_SERVERS;
  } catch (error) {
    console.warn('Failed to fetch TURN credentials, falling back to STUN:', error);
    return DEFAULT_ICE_SERVERS;
  }
};

export const useCall = () => {
  // Sound effects for call tones
  const { playCalling, playRingtone, playEndCall, stopCalling, stopRingtone } = useSoundEffects();

  const [callState, setCallState] = useState(null); // null, 'initiating', 'ringing', 'active', 'ended'
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [remoteIsMuted, setRemoteIsMuted] = useState(false); // Remote mute status
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true); // Remote video status
  const [callDuration, setCallDuration] = useState(0);
  const [activeCall, setActiveCall] = useState(null); // { callId, appointmentId, receiverId, callType }
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false); // Track if remote is screen sharing
  const [cameraStreamDuringScreenShare, setCameraStreamDuringScreenShare] = useState(null); // Camera stream for small window during screen share
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('good'); // 'excellent', 'good', 'fair', 'poor'
  const [availableMicrophones, setAvailableMicrophones] = useState([]);
  const [availableSpeakers, setAvailableSpeakers] = useState([]);
  const [currentMicrophoneId, setCurrentMicrophoneId] = useState(null);
  const [currentSpeakerId, setCurrentSpeakerId] = useState(null);
  const [isSyncingSummary, setIsSyncingSummary] = useState(false); // Waiting for authoritative duration
  const [isReconnecting, setIsReconnecting] = useState(false); // Internet drop/WebRTC disconnect
  const [reconnectReason, setReconnectReason] = useState(null); // 'local-offline' or 'remote-disconnected'
  const [isMinimized, setIsMinimized] = useState(false); // Whether to show full modal or just the bar

  // Pre-call preferences (set before call is answered, applied when call connects)
  const [preCallMuted, setPreCallMuted] = useState(false);
  const [preCallVideoOff, setPreCallVideoOff] = useState(false);

  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // For audio calls
  const callStartTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastSecondRef = useRef(null);
  const pendingOfferRef = useRef(null); // Store offer if received before peer is created
  const screenShareStreamRef = useRef(null); // Store screen share stream
  const originalCameraStreamRef = useRef(null); // Store original camera stream before screen share
  const containerRef = useRef(null); // For fullscreen
  const callingSoundRef = useRef(null); // Reference to calling sound audio element
  const ringtoneSoundRef = useRef(null); // Reference to ringtone sound audio element
  const isEndingCallRef = useRef(false); // Flag to prevent double end call sound
  const reconnectTimeoutRef = useRef(null); // Timer for internet dropout reconnection

  // Refs to store current state for event handlers (to avoid stale closures)
  const incomingCallRef = useRef(null);
  const activeCallRef = useRef(null);
  const callStateRef = useRef(null);
  const localStreamRef = useRef(null); // Ref for localStream to access in monitor peer handlers
  const remoteIsScreenSharingRef = useRef(false); // Ref for remote screen sharing status to detect transitions
  const preCallMutedRef = useRef(false); // Ref for preCallMuted to access in handleCallAccepted
  const preCallVideoOffRef = useRef(false); // Ref for preCallVideoOff to access in handleCallAccepted

  // Admin monitor peers: Map of adminSocketId -> SimplePeer instance
  const monitorPeersRef = useRef(new Map());

  // Unique tab identifier to prevent BroadcastChannel self-reception
  const tabIdRef = useRef(Math.random().toString(36).substr(2, 9));

  // Helper to STOP all media tracks and reset peer (used by endCall and Tab Switching)
  const cleanupCall = useCallback(() => {
    // 1. Stop all sounds
    stopCalling();
    stopRingtone();
    callingSoundRef.current = null;
    ringtoneSoundRef.current = null;

    // 2. Reset reconnection state
    setIsReconnecting(false);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 3. Stop media streams (use refs to avoid stale closures)
    const streamToStop = localStreamRef.current;
    if (streamToStop) {
      streamToStop.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setLocalStream(null);
      localStreamRef.current = null;
    }

    // Stop remote stream - also check video/audio element refs for stale stream
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    // Fallback: stop tracks directly from video/audio elements in case state was stale
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (remoteAudioRef.current?.srcObject) {
      remoteAudioRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    // Also check localVideoRef
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }

    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current = null;
    }

    if (cameraStreamDuringScreenShare) {
      cameraStreamDuringScreenShare.getTracks().forEach(track => track.stop());
      setCameraStreamDuringScreenShare(null);
    }
    // Also check original camera stream ref
    if (originalCameraStreamRef.current) {
      originalCameraStreamRef.current.getTracks().forEach(track => track.stop());
      originalCameraStreamRef.current = null;
    }

    // 4. Destroy peer connections
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (monitorPeersRef.current.size > 0) {
      monitorPeersRef.current.forEach(peer => {
        try { peer.destroy(); } catch (err) { console.error('Error destroying monitor peer:', err); }
      });
      monitorPeersRef.current.clear();
    }

    // 5. Clear visuals
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    // 6. Stop timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    callStartTimeRef.current = null;
    lastSecondRef.current = null;
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setRemoteIsMuted(false);
    setRemoteVideoEnabled(true);
    setRemoteIsScreenSharing(false);
    setIsFullscreen(false);
    setIsMinimized(false);
    setConnectionQuality('excellent');
    setReconnectReason(null);
    // Reset pre-call preferences
    setPreCallMuted(false);
    setPreCallVideoOff(false);

    // Exit browser fullscreen if active on call cleanup
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(err => console.warn('Exit fullscreen failed:', err));
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      } catch (err) {
        console.warn('Error exiting fullscreen on cleanup:', err);
      }
    }
  }, [localStream, remoteStream, cameraStreamDuringScreenShare, stopCalling, stopRingtone]);

  // Apply pre-call preferences to stream tracks in real-time during ringing/initiating phase
  useEffect(() => {
    if (!localStream || (callState !== 'ringing' && callState !== 'initiating')) return;
    // Sync mic mute to actual audio tracks
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !preCallMuted;
    });
    // Sync video off to actual video tracks
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !preCallVideoOff;
    });
  }, [preCallMuted, preCallVideoOff, localStream, callState]);

  // Update refs when state changes (so handlers can access current values)
  useEffect(() => {
    incomingCallRef.current = incomingCall;
    activeCallRef.current = activeCall;
    callStateRef.current = callState;
    localStreamRef.current = localStream;
    remoteIsScreenSharingRef.current = remoteIsScreenSharing;
    preCallMutedRef.current = preCallMuted;
    preCallVideoOffRef.current = preCallVideoOff;
  }, [incomingCall, activeCall, callState, localStream, remoteIsScreenSharing, preCallMuted, preCallVideoOff]);

  // Connection monitoring (Window level)
  useEffect(() => {
    const handleOffline = () => {
      if (!activeCallRef.current) return;
      
      setIsReconnecting(true);
      setReconnectReason('local-offline');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      
      // Give 60 seconds to reconnect before ending
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!navigator.onLine && activeCallRef.current) {
          toast.error('No internet connection. Call ended.');
          endCall();
        }
      }, 60000);
    };

    const handleOnline = () => {
      if (!activeCallRef.current) return;
      
      setIsReconnecting(false);
      setReconnectReason(null);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Force socket reconnection
      reconnectSocket();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // --- Navigation & Refresh Blocking ---
  
  // 1. window.onbeforeunload to prevent page refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (callState === 'active' || callState === 'ringing') {
        const message = 'You have an active call. Refreshing will disconnect you.';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [callState]);

  // 3. BroadcastChannel for cross-tab session management
  useEffect(() => {
    const bc = new BroadcastChannel('urbansetu_call_sync');
    
    bc.onmessage = (event) => {
      // Ignore messages from this same tab (tabId guard)
      if (event.data.senderTabId === tabIdRef.current) return;

      if (event.data.type === 'CALL_TAKEN_OVER' && event.data.callId === activeCallRef.current?.callId) {
        // Do not yield an active link call tab to passive background sync from another tab
        if (activeCallRef.current?.callMode === 'link' && !event.data.isExplicit) {
          console.log('[Call Sync] Ignoring passive CALL_TAKEN_OVER for active link call tab');
          return;
        }
        // Another tab has taken over this call
        toast.info('Call moved to another tab.');
        // Don't emit 'call-end' to server, just cleanup local state
        cleanupCall();
        setCallState(null);
        setActiveCall(null);
      } else if (event.data.type === 'CALL_ACCEPTED_ELSEWHERE' && incomingCallRef.current?.callId === event.data.callId) {
        console.log('[Call Sync] Call accepted on another tab, cleaning up ringing UI');
        stopRingtone();
        ringtoneSoundRef.current = null;
        setIncomingCall(null);
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false);
      } else if (event.data.type === 'CALL_REJECTED_ELSEWHERE' && incomingCallRef.current?.callId === event.data.callId) {
        console.log('[Call Sync] Call rejected on another tab, cleaning up');
        stopRingtone();
        ringtoneSoundRef.current = null;
        setIncomingCall(null);
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false);
      } else if (event.data.type === 'CALL_CANCELLED_ELSEWHERE' && 
                ((incomingCallRef.current && incomingCallRef.current.callId === event.data.callId) ||
                 (activeCallRef.current && activeCallRef.current.callId === event.data.callId))) {
        console.log('[Call Sync] Call cancelled on another tab');
        stopRingtone();
        stopCalling();
        ringtoneSoundRef.current = null;
        callingSoundRef.current = null;
        cleanupCall();
        setIncomingCall(null);
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false);
      }
    };

    return () => bc.close();
  }, [activeCall?.callId, cleanupCall, stopCalling, stopRingtone]);

  // Socket initialization and session recovery
  useEffect(() => {
    const handleConnect = async () => {
      // 1. If we ALREADY had an active call in this specific tab/state, try to resume WebRTC
      if (activeCallRef.current?.callId) {
        console.log('[Call] Socket reconnected, resuming call:', activeCallRef.current.callId);
        const callId = activeCallRef.current.callId;
        const currentStream = localStreamRef.current;

        // Destroy old (likely dead) peer and create a fresh non-initiator peer
        // so we're ready to accept the reoffer from the other side
        if (currentStream) {
          if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
          }

          // Clear stale remote stream so React re-renders when new stream arrives
          setRemoteStream(null);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

          try {
            const iceServers = await fetchIceServers();
            const peer = new SimplePeer({
              initiator: false,
              trickle: true,
              stream: currentStream,
              config: { iceServers }
            });

            if (peer._pc) {
              peer._pc.addEventListener('track', (event) => {
                if (event.streams && event.streams[0]) {
                  setRemoteStream(event.streams[0]);
                }
              });
            }

            peer.on('signal', (data) => {
              if (data.type === 'answer') {
                socket.emit('webrtc-answer', { callId, answer: data });
              } else if (data.type === 'candidate') {
                socket.emit('ice-candidate', { callId, candidate: data });
              }
            });

            peer.on('stream', (remoteStr) => {
              setRemoteStream(remoteStr);
            });

            peer.on('connect', () => {
              console.log('[Call Reconnect] Peer connected!');
              setIsReconnecting(false);
              setReconnectReason(null);
            });

            peer.on('error', (err) => {
              if (isEndingCallRef.current || (err.message && (err.message.includes('Abort') || err.message.includes('Close called')))) return;
              console.error('[Call Reconnect] Peer error:', err);
            });

            // If there's a pending offer that arrived before peer was created, signal it now
            if (pendingOfferRef.current && pendingOfferRef.current.callId === callId) {
              peer.signal(pendingOfferRef.current.offer);
              pendingOfferRef.current = null;
            }

            peerRef.current = peer;
            setupPeerConnectionMonitoring(peer);
          } catch (err) {
            console.error('[Call Reconnect] Error creating peer:', err);
          }
        }

        socket.emit('call-resume', { callId });
      } else {
        // 2. If we just connected/refreshed, pull authoritative state from server
        console.log('[Call Recovery] Requesting call state pull...');
        socket.emit('check-active-call');
      }
    };

    // AUTHORITATIVE SESSION RECOVERY: Triggered after login/refresh/explicit pull
    const handleActiveSession = async (session) => {
      // If we are already in THIS call, don't re-trigger recovery
      // Use REFS for instant check (not state, which lags behind by one render)
      if (activeCallRef.current?.callId === session.callId) {
        console.log('[Call Recovery] Already in call, skipping UI re-trigger');
        return;
      }

      console.log('[Call Recovery] Server sent active session:', session);

      // IMMEDIATELY update refs to prevent double-fire
      // (The server sends active-call-session from BOTH initial connect AND check-active-call)
      activeCallRef.current = { callId: session.callId };
      callStateRef.current = session.status || 'active';      
      // Notify other tabs that WE are taking over this call
      const bc = new BroadcastChannel('urbansetu_call_sync');
      bc.postMessage({ type: 'CALL_TAKEN_OVER', callId: session.callId, senderTabId: tabIdRef.current });
      bc.close();

      const recoveredCallType = session.callType;
      const recoveredCallId = session.callId;

      setActiveCall({
        callId: recoveredCallId,
        appointmentId: session.appointmentId,
        receiverId: session.role === 'caller' ? session.receiverId : session.callerId,
        callType: recoveredCallType,
        isRecovered: true,
        callerName: session.callerName,
        receiverName: session.receiverName
      });

      setCallState(session.status || 'active');
      setIsReconnecting(true);
      setReconnectReason('local-offline');
      setIsMinimized(false); // Show full modal so user sees reconnection happening

      // --- CRITICAL: Actually acquire media and create a new peer ---
      try {
        console.log('[Call Recovery] Requesting media permissions...');
        const constraints = {
          audio: true,
          video: recoveredCallType === 'video' ? (currentCameraId ? { deviceId: { exact: currentCameraId } } : true) : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[Call Recovery] Media acquired successfully');

        setLocalStream(stream);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Restore mute/video state from server session
        if (session.isMuted) {
          stream.getAudioTracks().forEach(track => { track.enabled = false; });
          setIsMuted(true);
        }
        if (session.isVideoEnabled === false && recoveredCallType === 'video') {
          stream.getVideoTracks().forEach(track => { track.enabled = false; });
          setIsVideoEnabled(false);
        }

        // Restore remote state indicators
        if (session.remoteIsMuted !== undefined) setRemoteIsMuted(session.remoteIsMuted);
        if (session.remoteIsVideoEnabled !== undefined) setRemoteVideoEnabled(session.remoteIsVideoEnabled);

        // Create a new SimplePeer as NON-initiator (the other user will send a fresh offer)
        const iceServers = await fetchIceServers();
        const peer = new SimplePeer({
          initiator: false,
          trickle: true,
          stream: stream,
          config: { iceServers }
        });

        if (peer._pc) {
          peer._pc.addEventListener('track', (event) => {
            if (event.streams && event.streams[0]) {
              setRemoteStream(event.streams[0]);
            }
          });
        }

        peer.on('signal', (data) => {
          if (data.type === 'answer') {
            socket.emit('webrtc-answer', { callId: recoveredCallId, answer: data });
          } else if (data.type === 'candidate') {
            socket.emit('ice-candidate', { callId: recoveredCallId, candidate: data });
          }
        });

        peer.on('stream', (remoteStr) => {
          setRemoteStream(remoteStr);
        });

        peer.on('connect', () => {
          console.log('[Call Recovery] Peer connected!');
        });

        peer.on('error', (err) => {
          if (isEndingCallRef.current || (err.message && (err.message.includes('Abort') || err.message.includes('Close called')))) return;
          console.error('[Call Recovery] Peer error:', err);
        });

        // If there's a pending offer that arrived before peer was created, signal it now
        if (pendingOfferRef.current && pendingOfferRef.current.callId === recoveredCallId) {
          console.log('[Call Recovery] Signaling pending offer');
          peer.signal(pendingOfferRef.current.offer);
          pendingOfferRef.current = null;
        }

        peerRef.current = peer;
        setupPeerConnectionMonitoring(peer);

        // Sync timer from server's startTime
        if (session.startTime) {
          startCallTimer(new Date(session.startTime));
        }

        // Tell server we're back — server will tell the other user to send a new offer
        socket.emit('call-resume', { callId: recoveredCallId });

        toast.info('Resuming ongoing call...');
      } catch (error) {
        console.error('[Call Recovery] Failed to acquire media:', error);
        setIsReconnecting(false);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toast.error('Camera/Microphone permission denied. Cannot rejoin call.');
        } else {
          toast.error('Failed to access camera/microphone for call recovery.');
        }
        // End call since we can't recover without media
        endCall();
      }
    };

    socket.on('connect', handleConnect);
    socket.on('active-call-session', handleActiveSession);

    // CRITICAL: Immediate check if socket is ALREADY connected when effect runs
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('active-call-session', handleActiveSession);
    };
  }, []);

  // Helper to monitor WebRTC connection health
  const setupPeerConnectionMonitoring = useCallback((peer) => {
    if (!peer || !peer._pc) return;

    const pc = peer._pc;

    // Immediate check: if already connected, clear any stale reconnecting state
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed' || pc.connectionState === 'connected') {
      setIsReconnecting(false);
      setReconnectReason(null);
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE Connection: ${pc.iceConnectionState}`);
      
      if (pc.iceConnectionState === 'disconnected') {
        setIsReconnecting(true);
        // Only set remote-disconnected if we are actually online
        if (navigator.onLine) {
          setReconnectReason('remote-disconnected');
        } else {
          setReconnectReason('local-offline');
        }
        
        // Start a graceful recovery timer
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if ((pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') && activeCallRef.current) {
            toast.error('Connection timeout. Call ended.');
            endCall();
          }
        }, 45000);
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsReconnecting(false);
        setReconnectReason(null);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      } else if (pc.iceConnectionState === 'failed') {
        setIsReconnecting(true);
        if (navigator.onLine) {
          setReconnectReason('remote-disconnected');
        } else {
          setReconnectReason('local-offline');
        }
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (pc.iceConnectionState === 'failed' && activeCallRef.current) {
            toast.error('Call connection failed.');
            endCall();
          }
        }, 30000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection State: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setIsReconnecting(false);
        setReconnectReason(null);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      } else if (pc.connectionState === 'failed') {
        setIsReconnecting(true);
        if (navigator.onLine) {
          setReconnectReason('remote-disconnected');
        } else {
          setReconnectReason('local-offline');
        }
      }
    };
  }, []);

  // Handle WebRTC offer
  const handleWebRTCOffer = useCallback(({ callId, offer }) => {
    // If peer doesn't exist yet (receiver), store the offer
    if (!peerRef.current) {
      // Only store if it matches incoming call
      if (incomingCallRef.current?.callId === callId || activeCallRef.current?.callId === callId) {
        pendingOfferRef.current = { callId, offer };
      }
      return;
    }

    if (activeCallRef.current?.callId !== callId) {
      return;
    }

    try {
      peerRef.current.signal(offer);
    } catch (error) {
      console.error('[Call] Error handling WebRTC offer:', error);
    }
  }, []);

  // Handle WebRTC answer
  const handleWebRTCAnswer = useCallback(({ callId, answer }) => {
    if (!peerRef.current) {
      return;
    }

    if (activeCallRef.current?.callId !== callId) {
      return;
    }

    try {
      peerRef.current.signal(answer);
    } catch (error) {
      console.error('[Call] Error handling WebRTC answer:', error);
    }
  }, []);

  // Handle ICE candidate
  const handleICECandidate = useCallback(({ callId, candidate }) => {
    if (!peerRef.current) {
      return;
    }

    if (activeCallRef.current?.callId !== callId) {
      return;
    }

    try {
      if (candidate) {
        peerRef.current.signal(candidate);
      }
    } catch (error) {
      console.error('[Call] Error handling ICE candidate:', error);
    }
  }, []);

  // Handle remote mute/video status updates
  const handleRemoteStatusUpdate = useCallback(({ callId, isMuted: remoteMuted, isVideoEnabled: remoteVideo, isScreenSharing: remoteScreenSharing }) => {
    if (activeCall?.callId === callId) {
      if (remoteMuted !== undefined) setRemoteIsMuted(remoteMuted);
      if (remoteVideo !== undefined) setRemoteVideoEnabled(remoteVideo);
      if (remoteScreenSharing !== undefined) {
        // If we were sharing and now we're not - show info
        if (remoteIsScreenSharingRef.current === true && remoteScreenSharing === false) {
          // Toast removed - handled by ActiveCallModal overlay
        }
        setRemoteIsScreenSharing(remoteScreenSharing);
      }
    }
  }, [activeCall]);

  // Handle request to stop screen sharing (when remote person wants to share)
  const handleStopRemoteScreenShare = useCallback(() => {
    if (isScreenSharing) {
      // Stop screen sharing when remote requests it
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(track => track.stop());
        screenShareStreamRef.current = null;
      }
      setIsScreenSharing(false);
      setCameraStreamDuringScreenShare(null);

      // Restore camera video in peer connection
      if (localStream && peerRef.current && originalCameraStreamRef.current) {
        const originalVideoTrack = originalCameraStreamRef.current.getVideoTracks()[0];
        if (originalVideoTrack) {
          const sender = peerRef.current._pc.getSenders().find(s =>
            s.track && s.track.kind === 'video'
          );
          if (sender && peerRef.current) {
            sender.replaceTrack(originalVideoTrack).catch(err => {
              console.error('Error restoring camera track:', err);
            });
          }
        }
      }
      // Toast removed - handled by ActiveCallModal overlay
    }
  }, [isScreenSharing, localStream]);

  // Maintain local stream on localVideoRef whenever it changes
  useEffect(() => {
    if (!localStream || !localVideoRef.current) return;

    // Only update if stream is different (avoid unnecessary updates)
    if (localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Local video should always be muted

      // Ensure video plays
      const playVideo = async () => {
        try {
          await localVideoRef.current.play();
        } catch (err) {
          console.error('Error playing local video:', err);
          // Retry after a short delay
          setTimeout(() => {
            localVideoRef.current?.play().catch(e => {
              console.error('Retry failed:', e);
            });
          }, 500);
        }
      };
      playVideo();
    }
  }, [localStream, localVideoRef]);

  // Attach remote stream to video/audio elements when stream or call type changes
  useEffect(() => {
    if (!remoteStream || !activeCall) {
      // Clean up when stream or call ends
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      setRemoteIsScreenSharing(false);
      return;
    }

    // Detect if remote is screen sharing by checking video track label
    // Check for enabled tracks with screen share labels (enabled = true means track is actively streaming)
    const videoTracks = remoteStream.getVideoTracks();
    const isRemoteScreenSharing = videoTracks.some(track =>
      track.enabled && track.label && (track.label.includes('screen') || track.label.includes('Screen') || track.label.includes('display'))
    );

    // Update remote screen sharing state
    setRemoteIsScreenSharing(isRemoteScreenSharing);

    // When remote switches from screen share to camera, force UI update
    // This helps with the rendering issue when screen share stops on remote side
    if (!isRemoteScreenSharing && remoteVideoRef.current) {
      // Force the ref to update by briefly setting to null then back
      setTimeout(() => {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject === remoteStream) {
          remoteVideoRef.current.srcObject = null;
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play().catch(err => {
                console.error('Error playing remote video after screen share detection:', err);
              });
            }
          }, 50);
        }
      }, 50);
    }

    // For video calls - attach to video element (video element handles both video and audio)
    if (activeCall.callType === 'video' && remoteVideoRef.current) {
      // Only update if stream is different (avoid unnecessary updates)
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        // Clear previous stream
        if (remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.muted = false; // Ensure audio is not muted
        // Ensure video plays
        const playVideo = async () => {
          try {
            await remoteVideoRef.current.play();
          } catch (err) {
            console.error('Error playing remote video:', err);
            // Retry after a short delay
            setTimeout(() => {
              remoteVideoRef.current?.play().catch(e => {
                console.error('Retry failed:', e);
              });
            }, 500);
          }
        };
        playVideo();
      }
    }

    // For audio calls - attach to audio element
    if (activeCall.callType === 'audio' && remoteAudioRef.current) {
      // Only update if stream is different (avoid unnecessary updates)
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        // Clear previous stream
        if (remoteAudioRef.current.srcObject) {
          remoteAudioRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = false; // Ensure audio is not muted
        // Ensure audio plays automatically
        const playAudio = async () => {
          try {
            await remoteAudioRef.current.play();
          } catch (err) {
            console.error('Error playing remote audio:', err);
            // Retry after a short delay
            setTimeout(() => {
              if (remoteAudioRef.current) {
                remoteAudioRef.current.play().catch(e => {
                  console.error('Retry failed:', e);
                });
              }
            }, 500);
          }
        };
        playAudio();
      }
    }

    // Cleanup function
    return () => {
      if (!activeCall && remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [remoteStream, activeCall]);

  // Start call timer with server-synchronized start time
  // CRITICAL: This function MUST be called with server's startTime to ensure both sides are synchronized
  // Start call timer with server-synchronized start time
  // CRITICAL: This function MUST be called with server's startTime to ensure both sides are synchronized
  const startCallTimer = useCallback((synchronizedStartTime) => {
    if (!synchronizedStartTime) {
      console.error('[Call Timer] ERROR: Cannot start timer without server startTime!');
      return;
    }

    // Stop any existing timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Use the exact server start time as the reference point
    // Both sides will use this same timestamp, ensuring perfect synchronization
    const serverStartTimestamp = synchronizedStartTime.getTime();

    // Calculate initial elapsed time to display immediately (accounts for network latency)
    const currentTimestamp = Date.now();
    const elapsedMilliseconds = currentTimestamp - serverStartTimestamp;

    // UX IMPROVEMENT: If elapsed time is small (e.g. < 3000ms), assume it's a fresh call 
    // and sync to local time for better UX. This prevents the timer from jumping to 00:02 
    // immediately due to network latency, ensuring both sides see "00:00" start.
    if (elapsedMilliseconds < 3000 && elapsedMilliseconds >= 0) {
      callStartTimeRef.current = currentTimestamp;
    } else {
      callStartTimeRef.current = serverStartTimestamp;
    }

    lastSecondRef.current = null;

    // Set initial duration immediately
    const initialDuration = Math.max(0, Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    setCallDuration(initialDuration);
    lastSecondRef.current = initialDuration;

    // Use requestAnimationFrame for smooth, precise updates
    // Calculate duration from server timestamp each frame, ensuring no drift
    const updateTimer = () => {
      if (!callStartTimeRef.current) {
        return;
      }

      // Always calculate from server's startTime - this ensures perfect synchronization
      // Even if intervals drift, both sides calculate from the same reference point
      const now = Date.now();
      // Use Math.max(0, ...) to prevent negative durations due to clock skew
      // If server time is slightly ahead of client time, ensure duration starts at 0
      const duration = Math.max(0, Math.floor((now - callStartTimeRef.current) / 1000));

      // Only update state when the second changes to avoid unnecessary re-renders
      if (duration !== lastSecondRef.current) {
        lastSecondRef.current = duration;
        setCallDuration(duration);
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    };

    // Start the animation frame loop immediately for instant updates
    // This ensures the timer starts ticking right away, not waiting for the first frame
    animationFrameRef.current = requestAnimationFrame(updateTimer);

    // Also use interval as backup for reliability, but start immediately with a small delay
    // This ensures the timer ticks immediately rather than waiting up to 1000ms
    const immediateUpdate = () => {
      if (callStartTimeRef.current) {
        const now = Date.now();
        const duration = Math.max(0, Math.floor((now - callStartTimeRef.current) / 1000));
        if (duration !== lastSecondRef.current) {
          lastSecondRef.current = duration;
          setCallDuration(duration);
        }
      }
    };

    // Trigger immediate update to ensure timer starts ticking right away
    immediateUpdate();

    // Then set up interval for regular updates (every 1000ms)
    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        // Always calculate from server's startTime, not local time
        // This double-check ensures accuracy even if animation frame is delayed
        // Use Math.max(0, ...) to prevent negative durations due to clock skew
        const duration = Math.max(0, Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        if (duration !== lastSecondRef.current) {
          lastSecondRef.current = duration;
          setCallDuration(duration);
        }
      }
    }, 1000);
  }, []);

  // Listen for incoming calls and WebRTC events
  useEffect(() => {
    const handleIncomingCall = (data) => {
      // Prevent handling new incoming call if already in a call or receiving one
      if (activeCallRef.current || incomingCallRef.current || callStateRef.current) {
        console.warn('Blocking concurrent incoming call:', data.callId);
        // Optionally emit 'busy' back to server if needed, but server should handle this.
        return;
      }

      setIncomingCall(data);
      // Play ringtone when receiving incoming call
      stopCalling(); // Stop any calling sound that might be playing
      ringtoneSoundRef.current = playRingtone();
    };

    const handlePeerReconnecting = ({ callId, role }) => {
      if ((activeCallRef.current && activeCallRef.current.callId === callId) ||
        (incomingCallRef.current && incomingCallRef.current.callId === callId)) {
        setIsReconnecting(true);
        setReconnectReason('remote-disconnected');
      }
    };

    const handlePeerResumed = ({ callId, role }) => {
      if ((activeCallRef.current && activeCallRef.current.callId === callId) ||
        (incomingCallRef.current && incomingCallRef.current.callId === callId)) {
        // Don't clear isReconnecting here — it will be cleared when ICE connects
        console.log(`[Call] Peer ${role} has resumed for call ${callId}`);
      }
    };

    // Handle request-reoffer: the OTHER user (who didn't refresh) must create a new offer
    const handleRequestReoffer = async ({ callId }) => {
      if (!activeCallRef.current || activeCallRef.current.callId !== callId) return;
      console.log('[Call Recovery] Other user rejoined, creating new offer...');

      try {
        const currentStream = localStreamRef.current;
        if (!currentStream) {
          console.warn('[Call Recovery] No local stream available for reoffer');
          return;
        }

        // Destroy old peer if exists
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }

        // Clear stale remote stream so React re-renders when new stream arrives
        setRemoteStream(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

        const iceServers = await fetchIceServers();
        const peer = new SimplePeer({
          initiator: true,
          trickle: true,
          stream: currentStream,
          config: { iceServers }
        });

        if (peer._pc) {
          peer._pc.addEventListener('track', (event) => {
            if (event.streams && event.streams[0]) {
              setRemoteStream(event.streams[0]);
            }
          });
        }

        peer.on('signal', (data) => {
          if (data.type === 'offer') {
            socket.emit('webrtc-offer', { callId, offer: data });
          } else if (data.type === 'candidate') {
            socket.emit('ice-candidate', { callId, candidate: data });
          }
        });

        peer.on('stream', (remoteStr) => {
          setRemoteStream(remoteStr);
        });

        peer.on('connect', () => {
          console.log('[Call Recovery] Reoffer peer connected!');
          setIsReconnecting(false);
          setReconnectReason(null);
        });

        peer.on('error', (err) => {
          if (isEndingCallRef.current || (err.message && (err.message.includes('Abort') || err.message.includes('Close called')))) return;
          console.error('[Call Recovery] Reoffer peer error:', err);
        });

        peerRef.current = peer;
        setupPeerConnectionMonitoring(peer);
      } catch (err) {
        console.error('[Call Recovery] Error creating reoffer:', err);
      }
    };

    const handleCallAccepted = (data) => {
      // Server provides the exact timestamp when call was accepted on the server
      // Both caller and receiver receive this same timestamp, ensuring perfect synchronization
      // startTime is sent as milliseconds (number) from server, convert to Date object
      const synchronizedStartTime = data.startTime ? new Date(data.startTime) : null;

      if (!synchronizedStartTime || !data.startTime) {
        console.error('[Call] CRITICAL: No synchronized startTime received from server! Cannot start timer.');
        toast.error('Call timer synchronization error. Please refresh.');
        return;
      }

      // For receiver (incoming call) - state already set in acceptCall, but timer MUST start with server time
      // Use refs to get current values without causing dependency issues
      if (incomingCallRef.current && incomingCallRef.current.callId === data.callId) {
        // Stop ringtone when call is accepted
        stopRingtone();
        ringtoneSoundRef.current = null;

        // Force immediate state update
        setCallState('active');

        // Always start/restart timer with server's synchronized time
        // This ensures timer starts at the exact same moment as on server, accounting for network latency
        startCallTimer(synchronizedStartTime);
      }
      // For caller (outgoing call)
      else if (activeCallRef.current && activeCallRef.current.callId === data.callId) {
        // Stop calling sound when call is accepted
        stopCalling();
        callingSoundRef.current = null;

        // Apply pre-call preferences to the caller's active state
        // CRITICAL: Use refs instead of state to avoid stale closure values.
        // The state values (preCallMuted/preCallVideoOff) are captured when this
        // useEffect registers, but the user may toggle them during the ringing phase.
        // Refs always reflect the latest value.
        const callerMuted = preCallMutedRef.current;
        const callerVideoOff = preCallVideoOffRef.current;
        if (callerMuted) {
          setIsMuted(true);
          // Also ensure actual audio tracks stay disabled
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = false; });
          }
        }
        if (callerVideoOff) {
          setIsVideoEnabled(false);
          // Also ensure actual video tracks stay disabled
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => { track.enabled = false; });
          }
        }
        // Reset pre-call preferences
        setPreCallMuted(false);
        setPreCallVideoOff(false);

        // Force immediate state update
        setCallState('active');

        // CRITICAL: Only start timer with server's startTime - never use local time
        startCallTimer(synchronizedStartTime);

        // Notify remote side about initial media state if pre-call preferences were set
        if (callerMuted || callerVideoOff) {
          setTimeout(() => {
            socket.emit('call-status-update', {
              callId: data.callId,
              isMuted: callerMuted,
              isVideoEnabled: !callerVideoOff
            });
          }, 500);
        }
      }
    };

    // Handle call accepted on another tab/device (receiver's other sockets)
    const handleCallAcceptedElsewhere = (data) => {
      if (incomingCallRef.current && incomingCallRef.current.callId === data.callId) {
        console.log('[Call Sync] Call accepted elsewhere via socket, cleaning up ringing UI');
        stopRingtone();
        ringtoneSoundRef.current = null;
        setIncomingCall(null);
        incomingCallRef.current = null;
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false);
      }
    };

    const handleCallRejected = (data) => {
      // Use ref to get current value without dependency
      if (activeCallRef.current && activeCallRef.current.callId === data.callId) {
        // Stop calling sound when call is rejected
        stopCalling();
        callingSoundRef.current = null;
        endCall();
        toast.info('Call was rejected');
      }
      // Stop ringtone when call is rejected (receiver side - other tabs)
      if (incomingCallRef.current && incomingCallRef.current.callId === data.callId) {
        stopRingtone();
        ringtoneSoundRef.current = null;
        setIncomingCall(null);
        incomingCallRef.current = null;
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false);
      }
    };

    const handleCallEnded = (data) => {
      // Use refs to get current values without dependency
      if ((activeCallRef.current && activeCallRef.current.callId === data.callId) ||
        (incomingCallRef.current && incomingCallRef.current.callId === data.callId)) {
        // Stop any playing sounds
        stopCalling();
        stopRingtone();
        callingSoundRef.current = null;
        ringtoneSoundRef.current = null;

        // If caller disconnected before call was actually connected,
        // force state to non-active so endCall won't show the summary
        if (data.reason === 'caller-disconnected' || data.reason === 'call-already-ended') {
          // Force callState to 'ringing' so endCall treats it as never-connected
          callStateRef.current = 'ringing';
          setCallState('ringing');
          // Clear incoming call state
          incomingCallRef.current = null;
          setIncomingCall(null);
          toast.info('Call cancelled — the other party is no longer available.');
          endCall();
          return;
        }

        // Only play end call sound if we didn't just end the call ourselves
        // (to prevent double playing when user clicks hang and server broadcasts back)
        if (!isEndingCallRef.current) {
          playEndCall();
        }
        // Show "Call ended" message when receiving call-ended event from other party
        toast.info('Call ended.');
        endCall(data.duration);
      }
    };

    const handleCallMissed = (data) => {
      // Use ref to get current value without dependency
      if (activeCallRef.current && activeCallRef.current.callId === data.callId) {
        // Stop calling sound when call is missed
        stopCalling();
        callingSoundRef.current = null;
        endCall();
        toast.info('Call was missed');
      }
      // Receiver side: clear incoming call modal when call is missed (30s server timeout)
      if (incomingCallRef.current && incomingCallRef.current.callId === data.callId) {
        stopRingtone();
        ringtoneSoundRef.current = null;
        // Clear all incoming call state so the modal/bubble disappears
        incomingCallRef.current = null;
        setIncomingCall(null);
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false);
        toast.info('Missed call');
      }
    };

    const handleCallCancelled = (data) => {
      // When caller cancels, receiver should close incoming call modal
      // Use refs to get current values without dependency
      if (incomingCallRef.current && incomingCallRef.current.callId === data.callId) {
        // Stop ringtone when call is cancelled
        stopRingtone();
        ringtoneSoundRef.current = null;
        setIncomingCall(null);
        // Don't call endCall here to avoid double cleanup, just clear incoming call state
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false); // Reset just in case
        toast.info('Call was cancelled');
      }
      // When caller cancels, caller should close ringing screen
      if (activeCallRef.current && activeCallRef.current.callId === data.callId &&
        (callStateRef.current === 'ringing' || callStateRef.current === 'initiating')) {
        // Stop calling sound when call is cancelled
        stopCalling();
        callingSoundRef.current = null;
        // endCall was already called, just ensure state is cleared
        setCallState(null);
        setActiveCall(null);
        setIsSyncingSummary(false); // Reset just in case
        toast.info('Call cancelled');
      }
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('peer-reconnecting', handlePeerReconnecting);
    socket.on('peer-resumed', handlePeerResumed);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-accepted-elsewhere', handleCallAcceptedElsewhere);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-missed', handleCallMissed);
    socket.on('call-cancelled', handleCallCancelled);
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('ice-candidate', handleICECandidate);
    socket.on('remote-status-update', handleRemoteStatusUpdate);
    socket.on('stop-remote-screen-share', handleStopRemoteScreenShare);
    socket.on('request-reoffer', handleRequestReoffer);
    socket.on('call-error', (error) => {
      console.error('Call error:', error);
      toast.error(error.message || 'Call error occurred');
      endCall();
    });

    // ===== Admin Monitor Request Handler (Participant Side) =====
    // When admin wants to monitor, we create a separate peer that sends our localStream to them
    const handleAdminMonitorRequest = async ({ callId, adminSocketId }) => {
      try {
        if (!activeCallRef.current || activeCallRef.current.callId !== callId) {
          return;
        }
        if (!localStreamRef.current) {
          console.warn('[Monitor] No local stream available for admin monitor');
          return;
        }

        // Create a monitor peer as initiator (we send offer to admin)
        const monitorPeer = new SimplePeer({
          initiator: true,
          trickle: true,
          stream: localStreamRef.current, // Send our local stream to admin
          config: {
            iceServers: await fetchIceServers()
          }
        });

        monitorPeer.on('signal', (data) => {
          if (data.type === 'offer') {
            socket.emit('webrtc-offer-monitor', {
              callId,
              adminSocketId,
              offer: data
            });
          } else if (data.type === 'candidate') {
            socket.emit('ice-candidate-monitor', {
              callId,
              adminSocketId,
              candidate: data,
              from: 'participant'
            });
          }
        });

        monitorPeer.on('connect', () => {
          console.log('[Monitor] Connected to admin monitor peer');
          if (isScreenSharing) {
            try {
              monitorPeer.send(JSON.stringify({ type: 'status-update', isScreenSharing: true }));
            } catch (e) {
              console.warn('[Monitor] Error sending initial status to admin:', e);
            }
          }
        });

        monitorPeer.on('error', (err) => {
          console.error('[Monitor] Peer error:', err);
          monitorPeersRef.current.delete(adminSocketId);
        });

        monitorPeer.on('close', () => {
          console.log('[Monitor] Peer closed');
          monitorPeersRef.current.delete(adminSocketId);
        });

        monitorPeersRef.current.set(adminSocketId, monitorPeer);

        // If actively screen sharing, replace camera video track with screen share track immediately on monitor peer
        if (isScreenSharing && screenShareStreamRef.current) {
          const screenVideoTracks = screenShareStreamRef.current.getVideoTracks();
          if (screenVideoTracks.length > 0) {
            setTimeout(() => {
              try {
                const sender = monitorPeer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                  sender.replaceTrack(screenVideoTracks[0]);
                  console.log('[Monitor] Replaced initial camera track with active screen share track for admin');
                }
              } catch (err) {
                console.error('[Monitor] Error replacing initial track for admin monitor:', err);
              }
            }, 500);
          }
        }
      } catch (err) {
        console.error('[Monitor] Error creating admin monitor peer:', err);
      }
    };

    // Admin answers our monitor offer
    const handleWebRTCAnswerMonitor = ({ callId, adminSocketId, answer }) => {
      if (!activeCallRef.current || activeCallRef.current.callId !== callId) return;
      const monitorPeer = monitorPeersRef.current.get(adminSocketId);
      if (monitorPeer && answer) {
        try {
          monitorPeer.signal(answer);
        } catch (err) {
          console.error('[Monitor] Error signaling answer to monitor peer:', err);
        }
      }
    };

    // Admin sends ICE candidates for monitor connection
    const handleICECandidateMonitor = ({ callId, adminSocketId, candidate }) => {
      if (!activeCallRef.current || activeCallRef.current.callId !== callId) return;
      const monitorPeer = monitorPeersRef.current.get(adminSocketId);
      if (monitorPeer && candidate) {
        try {
          monitorPeer.signal(candidate);
        } catch (err) {
          console.error('[Monitor] Error signaling ICE candidate to monitor peer:', err);
        }
      }
    };

    socket.on('admin-monitor-request', handleAdminMonitorRequest);
    socket.on('webrtc-answer-monitor', handleWebRTCAnswerMonitor);
    socket.on('ice-candidate-monitor', handleICECandidateMonitor);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('peer-reconnecting', handlePeerReconnecting);
      socket.off('peer-resumed', handlePeerResumed);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-accepted-elsewhere', handleCallAcceptedElsewhere);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-missed', handleCallMissed);
      socket.off('call-cancelled', handleCallCancelled);
      socket.off('webrtc-offer', handleWebRTCOffer);
      socket.off('webrtc-answer', handleWebRTCAnswer);
      socket.off('ice-candidate', handleICECandidate);
      socket.off('remote-status-update', handleRemoteStatusUpdate);
      socket.off('stop-remote-screen-share', handleStopRemoteScreenShare);
      socket.off('request-reoffer', handleRequestReoffer);
      socket.off('call-error');
      socket.off('admin-monitor-request', handleAdminMonitorRequest);
      socket.off('webrtc-answer-monitor', handleWebRTCAnswerMonitor);
      socket.off('ice-candidate-monitor', handleICECandidateMonitor);
    };
  }, [handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate, handleRemoteStatusUpdate, handleStopRemoteScreenShare, startCallTimer]);

  // Enumerate available cameras
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !currentCameraId) {
        setCurrentCameraId(videoDevices[0].deviceId);
      }
      return videoDevices;
    } catch (error) {
      console.error('Error enumerating cameras:', error);
      return [];
    }
  }, [currentCameraId]);

  // Switch camera
  const switchCamera = useCallback(async (deviceId) => {
    if (!localStream || !activeCall || activeCall.callType !== 'video') {
      return;
    }

    try {
      // Get new stream with selected camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { deviceId: { exact: deviceId } }
      });

      // Replace video track in peer connection
      const videoTrack = newStream.getVideoTracks()[0];
      const sender = peerRef.current?._pc?.getSenders()?.find(s =>
        s.track && s.track.kind === 'video'
      );

      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      }

      // Update local stream
      const oldVideoTrack = localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
      }
      localStream.removeTrack(oldVideoTrack);
      localStream.addTrack(videoTrack);

      // Update video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      setCurrentCameraId(deviceId);
      toast.success('Camera switched');
    } catch (error) {
      console.error('Error switching camera:', error);
      toast.error('Failed to switch camera');
    }
  }, [localStream, activeCall]);

  // Initialize call
  const initiateCall = async (appointmentId, receiverId, callType) => {
    // Request fullscreen immediately for video calls to preserve user gesture
    if (callType === 'video') {
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(err => console.warn('Early fullscreen request failed:', err));
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
      } catch (err) {
        console.warn('Failed to enter fullscreen on initiate:', err);
      }
    }

    try {
      // Check if socket is connected
      if (!socket || !socket.connected) {
        const token = getAuthToken();
        if (!token) {
          toast.error('Please sign in to make calls.');
          return;
        }

        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const currentTime = Date.now() / 1000;
            if (payload.exp && payload.exp < currentTime) {
              toast.error('Your session has expired. Please sign in again.');
              localStorage.removeItem('accessToken');
              document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
              window.location.href = '/sign-in?error=session_expired';
              return;
            }
          }
        } catch (e) {
          console.warn('Token validation failed:', e);
        }

        reconnectSocket();
        toast.info('Reconnecting to server...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!socket || !socket.connected) {
          toast.error('Failed to connect to server. Please refresh the page or sign in again.');
          return;
        }
      }

      setCallState('initiating');

      // Enumerate cameras for video calls
      if (callType === 'video') {
        await enumerateCameras();
      }

      // Get user media
      const constraints = {
        audio: true,
        video: callType === 'video' ? (currentCameraId ? { deviceId: { exact: currentCameraId } } : true) : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Wait for call ID from server before creating peer connection
      const handleCallInitiated = ({ callId, status }) => {
        if (status === 'ringing') {
          setActiveCall({ callId, appointmentId, receiverId, callType });
          setCallState('ringing');
          // Play calling sound when call is ringing
          callingSoundRef.current = playCalling();

          // Apply pre-call mute to stream tracks immediately
          if (preCallMuted) {
            stream.getAudioTracks().forEach(track => { track.enabled = false; });
          }
          if (preCallVideoOff && callType === 'video') {
            stream.getVideoTracks().forEach(track => { track.enabled = false; });
          }

          // Create peer connection AFTER we have the callId
          // Fetch ICE servers first
          fetchIceServers().then((iceServers) => {
            const peer = new SimplePeer({
              initiator: true,
              trickle: true,
              stream: stream, // SimplePeer will automatically add stream tracks
              config: {
                iceServers: iceServers
              }
            });

            // Track peer connection state changes
            if (peer._pc) {
              peer._pc.addEventListener('track', (event) => {
                if (event.streams && event.streams[0]) {
                  setRemoteStream(event.streams[0]);
                }
              });
            }

            peer.on('signal', (data) => {
              if (data.type === 'offer') {
                socket.emit('webrtc-offer', {
                  callId: callId,
                  offer: data
                });
              } else if (data.type === 'candidate') {
                socket.emit('ice-candidate', {
                  callId: callId,
                  candidate: data
                });
              }
            });

            peer.on('stream', (remoteStream) => {
              setRemoteStream(remoteStream);
              // Stream attachment will be handled by useEffect when remoteStream state updates
            });

            peer.on('connect', () => {
              // Connection established
            });

            peer.on('error', (err) => {
              // Silence specific errors during intentional teardown or aborts
              if (isEndingCallRef.current || (err.message && (err.message.includes('Abort') || err.message.includes('Close called')))) {
                return;
              }
              console.error('Peer connection error:', err);
              // Only end call if connection fails completely and no stream
              if (!remoteStream) {
                toast.error('Connection failed');
                endCall();
              }
            });

            peerRef.current = peer;
            setupPeerConnectionMonitoring(peer);
          });
        }
      };

      socket.once('call-initiated', handleCallInitiated);

      // Emit call initiation
      socket.emit('call-initiate', {
        appointmentId,
        receiverId,
        callType
      });

    } catch (error) {
      console.error('Error initiating call:', error);
      setCallState(null);

      // Exit fullscreen if early fullscreen was requested
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        try {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.warn('Exit fullscreen error on initiate failure:', err));
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        } catch (fsErr) {
          console.warn('Failed to exit fullscreen on initiate error:', fsErr);
        }
      }

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        error.isPermissionDenied = true;
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error('No microphone/camera found. Please connect a device.');
      } else {
        toast.error('Failed to access microphone/camera. Please check permissions.');
      }
      throw error;
    }
  };

  // ========== LINK-BASED CALLING ==========

  // Create a call link and wait for the receiver to join
  const initiateCallViaLink = async (appointmentId, callType) => {
    try {
      // Check socket connection (same as initiateCall)
      if (!socket || !socket.connected) {
        const token = getAuthToken();
        if (!token) {
          toast.error('Please sign in to make calls.');
          return null;
        }
        reconnectSocket();
        toast.info('Reconnecting to server...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!socket || !socket.connected) {
          toast.error('Failed to connect to server. Please refresh the page.');
          return null;
        }
      }

      // Call the API to create a link
      const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, callType })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || 'Failed to create call link');
        return null;
      }

      const data = await response.json();
      const { callId, linkToken, callLink } = data;

      return { callId, linkToken, callLink, callType, appointmentId };
    } catch (error) {
      console.error('Error creating call link:', error);
      toast.error('Failed to create call link');
      return null;
    }
  };

  // Start waiting for receiver after navigating to the call room (caller side)
  const startLinkCallWaiting = async (callId, linkToken, callType, appointmentId, receiverId) => {
    try {
      // Request fullscreen for video calls
      if (callType === 'video') {
        try {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(err => console.warn('Fullscreen request failed:', err));
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
          }
        } catch (err) {
          console.warn('Failed to enter fullscreen:', err);
        }
      }

      // Enumerate cameras for video calls
      if (callType === 'video') {
        await enumerateCameras();
      }

      // Get user media
      const constraints = {
        audio: true,
        video: callType === 'video' ? (currentCameraId ? { deviceId: { exact: currentCameraId } } : true) : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Apply current pre-call mute / video off preferences
      if (isMuted) {
        stream.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      if (!isVideoEnabled && callType === 'video') {
        stream.getVideoTracks().forEach(t => { t.enabled = false; });
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current && localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream;
      }

      setActiveCall({ callId, appointmentId, receiverId, callType, callMode: 'link', linkToken });
      setCallState('link-waiting');

      // Emit to server to register in the call room
      socket.emit('call-link-waiting', { callId, linkToken });

      // Listen for the receiver to join
      const handleLinkJoined = async (data) => {
        if (data.callId !== callId) return;
        socket.off('call-link-joined', handleLinkJoined);

        console.log('[Link Call] Receiver joined, starting WebRTC as initiator');

        // Start timer from server-provided startTime
        if (data.startTime) {
          startCallTimer(new Date(data.startTime));
        }

        // Create peer connection as initiator
        const iceServers = await fetchIceServers();
        const peer = new SimplePeer({
          initiator: true,
          trickle: true,
          stream: stream,
          config: { iceServers }
        });

        if (peer._pc) {
          peer._pc.addEventListener('track', (event) => {
            if (event.streams && event.streams[0]) {
              setRemoteStream(event.streams[0]);
            }
          });
        }

        peer.on('signal', (signalData) => {
          if (signalData.type === 'offer') {
            socket.emit('webrtc-offer', { callId, offer: signalData });
          } else if (signalData.type === 'candidate') {
            socket.emit('ice-candidate', { callId, candidate: signalData });
          }
        });

        peer.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
        });

        peer.on('connect', () => {
          console.log('[Link Call] Peer connection established (initiator)');
        });

        peer.on('error', (err) => {
          if (isEndingCallRef.current || (err.message && (err.message.includes('Abort') || err.message.includes('Close called')))) {
            return;
          }
          console.error('Peer connection error:', err);
          toast.error('Connection error occurred');
          endCall();
        });

        peerRef.current = peer;
        setupPeerConnectionMonitoring(peer);

        setCallState('active');
      };

      socket.on('call-link-joined', handleLinkJoined);

      // Listen for link expiry
      const handleLinkExpired = (data) => {
        if (data.callId !== callId) return;
        socket.off('call-link-expired', handleLinkExpired);
        socket.off('call-link-joined', handleLinkJoined);
        toast.error('Call link has expired');
        endCall();
      };
      socket.on('call-link-expired', handleLinkExpired);

    } catch (error) {
      console.error('Error starting link call waiting:', error);
      setCallState(null);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        error.isPermissionDenied = true;
      } else {
        toast.error('Failed to access microphone/camera. Please check permissions.');
      }
      throw error;
    }
  };

  // Join a call via link token (receiver side)
  const joinCallViaLink = async (callId, linkToken, callType, appointmentId, callerId) => {
    try {
      // Request fullscreen for video calls
      if (callType === 'video') {
        try {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(err => console.warn('Fullscreen request failed:', err));
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
          }
        } catch (err) {
          console.warn('Failed to enter fullscreen:', err);
        }
      }

      // Enumerate cameras for video calls
      if (callType === 'video') {
        await enumerateCameras();
      }

      // Get user media
      const constraints = {
        audio: true,
        video: callType === 'video' ? (currentCameraId ? { deviceId: { exact: currentCameraId } } : true) : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Apply current pre-call mute / video off preferences
      if (isMuted) {
        stream.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      if (!isVideoEnabled && callType === 'video') {
        stream.getVideoTracks().forEach(t => { t.enabled = false; });
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current && localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream;
      }

      setActiveCall({ callId, appointmentId, receiverId: callerId, callType, callMode: 'link', linkToken });
      setCallState('link-joining');

      // Emit join to server
      socket.emit('call-join-via-link', { callId, linkToken });

      // Listen for join acknowledgment
      const handleJoinAck = async (data) => {
        if (data.callId !== callId) return;
        socket.off('call-link-join-ack', handleJoinAck);

        console.log('[Link Call] Join acknowledged, waiting for WebRTC offer');

        // Start timer from server-provided startTime
        if (data.startTime) {
          startCallTimer(new Date(data.startTime));
        }

        // Create peer connection as non-initiator
        const iceServers = await fetchIceServers();
        const peer = new SimplePeer({
          initiator: false,
          trickle: true,
          stream: stream,
          config: { iceServers }
        });

        if (peer._pc) {
          peer._pc.addEventListener('track', (event) => {
            if (event.streams && event.streams[0]) {
              setRemoteStream(event.streams[0]);
            }
          });
        }

        peer.on('signal', (signalData) => {
          if (signalData.type === 'answer') {
            socket.emit('webrtc-answer', { callId, answer: signalData });
          } else if (signalData.type === 'candidate') {
            socket.emit('ice-candidate', { callId, candidate: signalData });
          }
        });

        peer.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
        });

        peer.on('connect', () => {
          console.log('[Link Call] Peer connection established (joiner)');
        });

        peer.on('error', (err) => {
          if (isEndingCallRef.current || (err.message && (err.message.includes('Abort') || err.message.includes('Close called')))) {
            return;
          }
          console.error('Peer connection error:', err);
          toast.error('Connection error occurred');
          endCall();
        });

        // If we already have a pending offer, signal it now
        if (pendingOfferRef.current && pendingOfferRef.current.callId === callId) {
          peer.signal(pendingOfferRef.current.offer);
          pendingOfferRef.current = null;
        }

        peerRef.current = peer;
        setupPeerConnectionMonitoring(peer);

        setCallState('active');
      };

      socket.on('call-link-join-ack', handleJoinAck);

    } catch (error) {
      console.error('Error joining call via link:', error);
      setCallState(null);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        error.isPermissionDenied = true;
      } else {
        toast.error('Failed to access microphone/camera. Please check permissions.');
      }
      throw error;
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall) return;

    // Request fullscreen immediately for video calls to preserve user gesture
    if (incomingCall.callType === 'video') {
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(err => console.warn('Early fullscreen request failed on accept:', err));
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
      } catch (err) {
        console.warn('Failed to enter fullscreen on accept:', err);
      }
    }

    try {
      // Enumerate cameras for video calls
      if (incomingCall.callType === 'video') {
        await enumerateCameras();
      }

      const constraints = {
        audio: true,
        video: incomingCall.callType === 'video' ? (currentCameraId ? { deviceId: { exact: currentCameraId } } : true) : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Update localStreamRef immediately for cleanup purposes
      localStreamRef.current = stream;

      // Fetch ICE servers first
      fetchIceServers().then((iceServers) => {
        const peer = new SimplePeer({
          initiator: false,
          trickle: true,
          stream: stream, // SimplePeer will automatically add stream tracks
          config: {
            iceServers: iceServers
          }
        });

        // Track peer connection state changes
        if (peer._pc) {
          peer._pc.addEventListener('track', (event) => {
            if (event.streams && event.streams[0]) {
              setRemoteStream(event.streams[0]);
            }
          });
        }

        peer.on('signal', (data) => {
          if (data.type === 'answer') {
            socket.emit('webrtc-answer', {
              callId: incomingCall.callId,
              answer: data
            });
          } else if (data.type === 'candidate') {
            socket.emit('ice-candidate', {
              callId: incomingCall.callId,
              candidate: data
            });
          }
        });

        peer.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
          // Stream attachment will be handled by useEffect when remoteStream state updates
        });

        peer.on('connect', () => {
          // Connection established
        });

        peer.on('error', (err) => {
          // Silence specific errors during intentional teardown or aborts
          if (isEndingCallRef.current || (err.message && (err.message.includes('Abort') || err.message.includes('Close called')))) {
            return;
          }
          console.error('Peer connection error:', err);
          toast.error('Connection error occurred');
          endCall();
        });

        // If we have a pending offer, signal it now
        if (pendingOfferRef.current && pendingOfferRef.current.callId === incomingCall.callId) {
          peer.signal(pendingOfferRef.current.offer);
          pendingOfferRef.current = null;
        }

        peerRef.current = peer;
        setupPeerConnectionMonitoring(peer);

        // Emit call accept AFTER peer is created
        socket.emit('call-accept', { callId: incomingCall.callId });
      });

      setActiveCall({
        callId: incomingCall.callId,
        appointmentId: incomingCall.appointmentId,
        receiverId: incomingCall.callerId,
        callType: incomingCall.callType
      });

      // Apply pre-call preferences to stream tracks
      const receiverMuted = preCallMuted;
      const receiverVideoOff = preCallVideoOff && incomingCall.callType === 'video';
      if (receiverMuted) {
        stream.getAudioTracks().forEach(track => { track.enabled = false; });
        setIsMuted(true);
      }
      if (receiverVideoOff) {
        stream.getVideoTracks().forEach(track => { track.enabled = false; });
        setIsVideoEnabled(false);
      }

      // Stop ringtone immediately when call is accepted (don't wait for server response)
      stopRingtone();
      ringtoneSoundRef.current = null;

      const savedCallId = incomingCall.callId;
      setCallState('active');
      setIncomingCall(null);
      // Reset pre-call preferences
      setPreCallMuted(false);
      setPreCallVideoOff(false);

      // Broadcast to other same-device tabs that this call was accepted here
      try {
        const bc = new BroadcastChannel('urbansetu_call_sync');
        bc.postMessage({ type: 'CALL_ACCEPTED_ELSEWHERE', callId: savedCallId, senderTabId: tabIdRef.current });
        bc.close();
      } catch (e) { /* BroadcastChannel not supported */ }

      // Notify caller about receiver's initial media state if pre-call preferences were set
      if (receiverMuted || receiverVideoOff) {
        setTimeout(() => {
          socket.emit('call-status-update', {
            callId: savedCallId,
            isMuted: receiverMuted,
            isVideoEnabled: !receiverVideoOff
          });
        }, 500);
      }
      // Timer will be started by handleCallAccepted with synchronized time from server
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Failed to access microphone/camera. Please check permissions.');

      // Stop tracks manually if stream was created but setup failed
      // This handles the case where setLocalStream state update hasn't propagated yet
      // and endCall relies on state.
      // Note: We can't easily access 'stream' here if declared in try block,
      // but since we set localStreamRef.current, we can use that via endCall if we ensure likely
      // availability or clean up what we can.
      rejectCall();
    }
  };

  // Reject call
  const rejectCall = () => {
    // Stop ringtone when rejecting call
    stopRingtone();
    ringtoneSoundRef.current = null;
    // Play end call sound when rejecting call
    playEndCall();
    if (incomingCall) {
      const rejectedCallId = incomingCall.callId;
      socket.emit('call-reject', { callId: rejectedCallId });
      setIncomingCall(null);

      // Broadcast to other same-device tabs that this call was rejected here
      try {
        const bc = new BroadcastChannel('urbansetu_call_sync');
        bc.postMessage({ type: 'CALL_REJECTED_ELSEWHERE', callId: rejectedCallId, senderTabId: tabIdRef.current });
        bc.close();
      } catch (e) { /* BroadcastChannel not supported */ }
    }
    endCall();
  };

  // End call
  const endCall = async (finalDuration = null) => {
    // Check if we are already in the 'ended' state (showing summary)
    // In this case, simply clear the final states and return
    if (callStateRef.current === 'ended') {
      setCallState(null);
      setActiveCall(null);
      setCallDuration(0);
      activeCallRef.current = null;
      return;
    }

    // Set flag to prevent double end call sound
    const wasEndingCall = isEndingCallRef.current;
    isEndingCallRef.current = true;

    // Use our helper to stop all local tracks and destroy peer
    cleanupCall();

    // Cancel call first if still initiating/ringing (before clearing state)
    // Use refs to get most current values for conditionals
    const currentActiveCall = activeCallRef.current;
    const currentCallState = callStateRef.current;

    if (currentActiveCall?.callId && (currentCallState === 'initiating' || currentCallState === 'ringing' || currentCallState === 'link-waiting' || currentCallState === 'link-joining')) {
      socket.emit('call-cancel', { callId: currentActiveCall.callId });

      // Broadcast to other same-device tabs that the call was cancelled
      try {
        const bc = new BroadcastChannel('urbansetu_call_sync');
        bc.postMessage({ type: 'CALL_CANCELLED_ELSEWHERE', callId: currentActiveCall.callId, senderTabId: tabIdRef.current });
        bc.close();
      } catch (e) { /* BroadcastChannel not supported */ }
    }

    // If user ends call, we'll get final duration from API response below
    if (finalDuration !== null) {
      setCallDuration(finalDuration);
      setIsSyncingSummary(false); // We already have it from socket
    } else if (currentCallState === 'active') {
      setIsSyncingSummary(true); // Need to wait for API response or socket broadcast
    }

    // Notify backend if call was active (not just ringing)
    const wasActive = currentActiveCall?.callId && currentCallState === 'active';

    if (wasActive) {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/calls/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: currentActiveCall.callId })
        });

        // Get authoritative duration from server if we don't have it yet
        if (response.ok) {
          const data = await response.json();
          if (data.call && typeof data.call.duration === 'number') {
            console.log(`[Call] Received authoritative server duration: ${data.call.duration}s`);
            setCallDuration(data.call.duration);
            setIsSyncingSummary(false); // Sync finished
          }
        }

        // Play end call sound when user ends the call
        // Only play if this is the first time ending (not from handleCallEnded)
        if (!wasEndingCall) {
          playEndCall();
        }
        // Show "Call ended" message when user ends the call
        toast.info('Call ended.');
      } catch (error) {
        console.error('Error ending call on server:', error);
        setIsSyncingSummary(false); // Cleanup so UI doesn't get stuck
        // Still play sound and show message even if backend call fails
        // Only play if this is the first time ending (not from handleCallEnded)
        if (!wasEndingCall) {
          playEndCall();
        }
        toast.info('Call ended.');
      }
    } else if (currentActiveCall?.callId || incomingCallRef.current?.callId) {
      // Play end call sound even if call wasn't active yet (ringing/incoming state)
      if (!wasEndingCall) {
        playEndCall();
      }
      toast.info('Call ended.');
      // Cleanup syncing state if call failed to properly start or ends in ringing
      setIsSyncingSummary(false);
    }

    // Transition to 'ended' state for summary instead of null if it was active
    if (wasActive) {
      setCallState('ended');
      // Keep activeCall for summary display
    } else {
      setCallState(null);
      setActiveCall(null);
      activeCallRef.current = null;
    }

    // Final cleanups
    setIncomingCall(null);
    pendingOfferRef.current = null;
    setRemoteIsMuted(false);
    setRemoteVideoEnabled(true);
    setIsScreenSharing(false);
    setRemoteIsScreenSharing(false);

    // Sync refs immediately to prevent race conditions
    incomingCallRef.current = null;
    callStateRef.current = wasActive ? 'ended' : null;

    // Reset flag after a short delay to allow for cleanup
    setTimeout(() => {
      isEndingCallRef.current = false;
    }, 1000);

  };

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      const newMutedState = !isMuted;
      // When muted, track.enabled should be false (disabled)
      // When unmuted, track.enabled should be true (enabled)
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState; // Opposite: muted = disabled, unmuted = enabled
      });
      setIsMuted(newMutedState);

      // Notify remote peer
      if (activeCall?.callId) {
        socket.emit('call-status-update', {
          callId: activeCall.callId,
          isMuted: newMutedState,
          isVideoEnabled: isVideoEnabled
        });
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const newVideoState = !isVideoEnabled;
      localStream.getVideoTracks().forEach(track => {
        track.enabled = newVideoState;
      });
      setIsVideoEnabled(newVideoState);

      // Notify remote peer
      if (activeCall?.callId) {
        socket.emit('call-status-update', {
          callId: activeCall.callId,
          isMuted: isMuted,
          isVideoEnabled: newVideoState
        });
      }
    }
  };

  // Toggle screen sharing (video calls only)
  const toggleScreenShare = async () => {
    // Check for screen sharing support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toast.error('Screen sharing is not supported on this device or browser (common on mobile).');
      return;
    }

    try {
      if (!isScreenSharing) {
        // Check if remote is already screen sharing
        if (remoteIsScreenSharing) {
          // Ask user for confirmation
          const confirmed = window.confirm(
            'Other person is also sharing. Are you sure you want to share yours? (This will stop their screen share)'
          );

          if (!confirmed) {
            return; // User cancelled
          }

          // Notify remote to stop screen sharing
          if (activeCall?.callId) {
            socket.emit('stop-remote-screen-share', {
              callId: activeCall.callId
            });
          }
        }

        // Start screen sharing
        // First, store the original camera stream for the small "You" window
        if (localStream) {
          const originalVideoTrack = localStream.getVideoTracks()[0];
          if (originalVideoTrack) {
            // Create a new stream with the original camera track for the small window
            // We only need the video track for display in the small window
            const originalCameraStream = new MediaStream([originalVideoTrack]);
            originalCameraStreamRef.current = originalCameraStream;
            setCameraStreamDuringScreenShare(originalCameraStream);
          }
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        });

        screenShareStreamRef.current = screenStream;
        setIsScreenSharing(true);

        if (activeCall?.callId) {
          socket.emit('call-status-update', {
            callId: activeCall.callId,
            isMuted: isMuted,
            isVideoEnabled: isVideoEnabled,
            isScreenSharing: true
          });
        }

        // Update monitor peers (Admin)
        if (monitorPeersRef.current.size > 0) {
          const videoTracks = screenStream.getVideoTracks();
          if (videoTracks.length > 0) {
            monitorPeersRef.current.forEach((monitorPeer) => {
              try {
                // Send status update via data channel
                monitorPeer.send(JSON.stringify({ type: 'status-update', isScreenSharing: true }));

                // Replace video track
                const sender = monitorPeer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                  sender.replaceTrack(videoTracks[0]);
                }
              } catch (err) {
                console.error('Error updating monitor peer with screen share:', err);
              }
            });
          }
        }

        // Replace video track in peer connection (send screen share to remote)
        if (localStream && peerRef.current) {
          const videoTracks = screenStream.getVideoTracks();
          const audioTracks = screenStream.getAudioTracks();

          // Replace video track in peer connection
          if (videoTracks.length > 0) {
            const sender = peerRef.current._pc.getSenders().find(s =>
              s.track && s.track.kind === 'video'
            );
            if (sender) {
              await sender.replaceTrack(videoTracks[0]);
            }
          }

          // Replace audio track if available (screen share audio)
          if (audioTracks.length > 0) {
            const sender = peerRef.current._pc.getSenders().find(s =>
              s.track && s.track.kind === 'audio'
            );
            if (sender && !isMuted) {
              await sender.replaceTrack(audioTracks[0]);
            }
          }
        }

        // Stop screen sharing when user stops sharing from browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          // Don't call toggleScreenShare to avoid showing dialog again
          // Instead, just handle stopping directly
          if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach(track => track.stop());
            screenShareStreamRef.current = null;
          }
          setIsScreenSharing(false);

          if (activeCall?.callId) {
            socket.emit('call-status-update', {
              callId: activeCall.callId,
              isMuted: isMuted,
              isVideoEnabled: isVideoEnabled,
              isScreenSharing: false
            });
          }

          // Restore monitor peers (Admin)
          if (monitorPeersRef.current.size > 0 && originalCameraStreamRef.current) {
            const originalVideoTrack = originalCameraStreamRef.current.getVideoTracks()[0];
            if (originalVideoTrack) {
              monitorPeersRef.current.forEach((monitorPeer) => {
                try {
                  monitorPeer.send(JSON.stringify({ type: 'status-update', isScreenSharing: false }));
                  const sender = monitorPeer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
                  if (sender) {
                    sender.replaceTrack(originalVideoTrack);
                  }
                } catch (err) {
                  console.error('Error restoring monitor peer track:', err);
                }
              });
            }
          }

          // Restore camera video in peer connection
          if (localStream && peerRef.current && originalCameraStreamRef.current) {
            const originalVideoTrack = originalCameraStreamRef.current.getVideoTracks()[0];
            if (originalVideoTrack) {
              const sender = peerRef.current._pc.getSenders().find(s =>
                s.track && s.track.kind === 'video'
              );
              if (sender && peerRef.current) {
                sender.replaceTrack(originalVideoTrack).catch(err => {
                  console.error('Error restoring camera track:', err);
                });
              }
            }
          }
          setCameraStreamDuringScreenShare(null);
          // Toast removed - handled by ActiveCallModal overlay
        };

        toast.success('Screen sharing started');
      } else {
        // Stop screen sharing
        if (screenShareStreamRef.current) {
          screenShareStreamRef.current.getTracks().forEach(track => track.stop());
          screenShareStreamRef.current = null;
        }

        setIsScreenSharing(false);

        if (activeCall?.callId) {
          socket.emit('call-status-update', {
            callId: activeCall.callId,
            isMuted: isMuted,
            isVideoEnabled: isVideoEnabled,
            isScreenSharing: false
          });
        }
        
        // Toast removed - handled by ActiveCallModal overlay

        // Restore monitor peers (Admin)
        if (monitorPeersRef.current.size > 0 && originalCameraStreamRef.current) {
          const originalVideoTrack = originalCameraStreamRef.current.getVideoTracks()[0];
          if (originalVideoTrack) {
            monitorPeersRef.current.forEach((monitorPeer) => {
              try {
                monitorPeer.send(JSON.stringify({ type: 'status-update', isScreenSharing: false }));
                const sender = monitorPeer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                  sender.replaceTrack(originalVideoTrack);
                }
              } catch (err) {
                console.error('Error restoring monitor peer track:', err);
              }
            });
          }
        }

        // Restore camera video in peer connection
        if (localStream && peerRef.current && originalCameraStreamRef.current) {
          const originalVideoTrack = originalCameraStreamRef.current.getVideoTracks()[0];
          const originalAudioTrack = localStream.getAudioTracks()[0]; // Use original audio from localStream

          if (originalVideoTrack) {
            const sender = peerRef.current._pc.getSenders().find(s =>
              s.track && s.track.kind === 'video'
            );

            if (sender && peerRef.current) {
              await sender.replaceTrack(originalVideoTrack);
            }
          }

          // Restore original audio track
          if (originalAudioTrack) {
            const sender = peerRef.current._pc.getSenders().find(s =>
              s.track && s.track.kind === 'audio'
            );
            if (sender && !isMuted) {
              await sender.replaceTrack(originalAudioTrack);
            }
          }

          // Clean up original camera stream ref - BUT DO NOT STOP TRACKS
          // The tracks in originalCameraStreamRef are references to the tracks in localStream.
          // Stopping them here would revoke camera access. We just null the ref.
          originalCameraStreamRef.current = null;
          setCameraStreamDuringScreenShare(null);

          // Force update local video element to show camera again
          if (localVideoRef.current && localStream) {
            // Re-attach the local stream to ensure video shows
            const currentSrcObject = localVideoRef.current.srcObject;
            if (currentSrcObject) {
              // Remove screen share tracks if any
              currentSrcObject.getTracks().forEach(track => {
                if (track.kind === 'video' && track.label.includes('screen')) {
                  track.stop();
                }
              });
            }
            // Ensure local stream is attached
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(err => {
              console.error('Error playing local video after screen share:', err);
            });
          }

          // Also force refresh the remote stream display when local stops sharing
          // This ensures the other party's video shows up again in the large view
          if (remoteVideoRef.current && remoteStream) {
            setTimeout(() => {
              if (remoteVideoRef.current && remoteVideoRef.current.srcObject === remoteStream) {
                // Force refresh by temporarily unsetting and resetting
                remoteVideoRef.current.srcObject = null;
                setTimeout(() => {
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    remoteVideoRef.current.muted = false;
                    remoteVideoRef.current.play().catch(err => {
                      console.error('Error playing remote video after local screen share stops:', err);
                    });
                  }
                }, 50);
              }
            }, 50);
          }
        } else if (localStream && callType === 'video' && currentCameraId) {
          // Fallback: recreate camera stream if original not stored
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: currentCameraId } },
            audio: true
          });

          const videoTrack = cameraStream.getVideoTracks()[0];
          const audioTrack = cameraStream.getAudioTracks()[0];
          const sender = peerRef.current?._pc?.getSenders()?.find(s =>
            s.track && s.track.kind === 'video'
          );

          if (sender && peerRef.current) {
            await sender.replaceTrack(videoTrack);
          }

          // Restore audio
          const audioSender = peerRef.current?._pc?.getSenders()?.find(s =>
            s.track && s.track.kind === 'audio'
          );
          if (audioSender && audioTrack && !isMuted) {
            await audioSender.replaceTrack(audioTrack);
          }

          // Update local stream
          localStream.getVideoTracks().forEach(track => track.stop());
          localStream.addTrack(videoTrack);

          // Update local video element
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(err => {
              console.error('Error playing local video after screen share:', err);
            });
          }

          // Stop the temporary camera stream audio (we use the original)
          cameraStream.getAudioTracks().forEach(track => track.stop());
        }

        // Toast removed - handled by ActiveCallModal overlay
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Screen sharing permission denied');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Screen sharing not supported in this browser');
      } else {
        toast.error('Failed to toggle screen sharing');
      }
      setIsScreenSharing(false);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) {
        containerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Enumerate audio devices
  const enumerateAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(d => d.kind === 'audioinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');

      setAvailableMicrophones(microphones);
      setAvailableSpeakers(speakers);

      // Set current devices
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const settings = audioTracks[0].getSettings();
          if (settings.deviceId) {
            setCurrentMicrophoneId(settings.deviceId);
          }
        }
      }

      // For speakers, use default if available
      if (speakers.length > 0 && !currentSpeakerId) {
        // Try to get default speaker from audio element if available
        setCurrentSpeakerId(speakers[0].deviceId || 'default');
      }

      return { microphones, speakers };
    } catch (error) {
      console.error('Error enumerating audio devices:', error);
      return { microphones: [], speakers: [] };
    }
  };

  // Switch microphone
  const switchMicrophone = async (deviceId) => {
    try {
      if (!localStream) return;

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: callType === 'video' ? (currentCameraId ? { deviceId: { exact: currentCameraId } } : true) : false
      });

      // Replace audio tracks
      const audioTrack = newStream.getAudioTracks()[0];
      const sender = peerRef.current?._pc?.getSenders()?.find(s =>
        s.track && s.track.kind === 'audio'
      );

      if (sender && peerRef.current) {
        await sender.replaceTrack(audioTrack);
      }

      // Update local stream
      localStream.getAudioTracks().forEach(track => track.stop());
      localStream.addTrack(audioTrack);

      // Stop video track from new stream (we only needed audio)
      if (callType === 'video') {
        newStream.getVideoTracks().forEach(track => track.stop());
      }

      setCurrentMicrophoneId(deviceId);
      toast.success('Microphone switched');
    } catch (error) {
      console.error('Error switching microphone:', error);
      toast.error('Failed to switch microphone');
    }
  };

  // Switch speaker (audio output)
  const switchSpeaker = async (deviceId) => {
    try {
      // Set sink ID for audio output (if supported)
      if (remoteAudioRef.current && remoteAudioRef.current.setSinkId) {
        await remoteAudioRef.current.setSinkId(deviceId);
        setCurrentSpeakerId(deviceId);
        toast.success('Speaker switched');
      } else if (remoteVideoRef.current && remoteVideoRef.current.setSinkId) {
        await remoteVideoRef.current.setSinkId(deviceId);
        setCurrentSpeakerId(deviceId);
        toast.success('Speaker switched');
      } else {
        toast.info('Speaker switching not supported in this browser');
      }
    } catch (error) {
      console.error('Error switching speaker:', error);
      toast.error('Failed to switch speaker');
    }
  };

  // Monitor connection quality
  useEffect(() => {
    if (!peerRef.current || !peerRef.current._pc || callState !== 'active') return;

    const checkConnectionQuality = async () => {
      try {
        if (!peerRef.current || !peerRef.current._pc || isEndingCallRef.current) return;
        const stats = await peerRef.current._pc.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let rtt = 0;
        let jitter = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
            if (report.packetsLost !== undefined) {
              packetsLost += report.packetsLost || 0;
            }
            if (report.packetsReceived !== undefined) {
              packetsReceived += report.packetsReceived || 0;
            }
            if (report.jitter !== undefined) {
              jitter += report.jitter || 0;
            }
          }
          if (report.type === 'candidate-pair' && report.selected) {
            if (report.currentRoundTripTime !== undefined) {
              rtt = report.currentRoundTripTime * 1000; // Convert to ms
            }
          }
        });

        // Determine quality based on metrics
        let quality = 'good';
        if (rtt < 100 && packetsLost === 0 && jitter < 30) {
          quality = 'excellent';
        } else if (rtt < 200 && packetsLost < 5 && jitter < 50) {
          quality = 'good';
        } else if (rtt < 300 && packetsLost < 10 && jitter < 100) {
          quality = 'fair';
        } else {
          quality = 'poor';
        }

        setConnectionQuality(quality);
        
        // Safety net: if we have good connection quality, the 'Reconnecting' overlay should NOT be visible
        if (quality !== 'poor' && isReconnecting) {
          console.log(`[Call Quality] Auto-clearing Reconnecting state (Quality: ${quality})`);
          setIsReconnecting(false);
          setReconnectReason(null);
        }
      } catch (error) {
        // Silently ignore errors during teardown
        if (!isEndingCallRef.current && peerRef.current?._pc) {
          console.error('Error checking connection quality:', error);
        }
      }
    };

    const qualityInterval = setInterval(checkConnectionQuality, 5000); // Check every 5 seconds

    return () => clearInterval(qualityInterval);
  }, [callState, peerRef.current]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      ));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Enumerate audio devices when call becomes active
  useEffect(() => {
    if (callState === 'active' && localStream) {
      enumerateAudioDevices();
    }
  }, [callState, localStream]);

  return {
    callState,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    remoteIsMuted,
    remoteVideoEnabled,
    callDuration,
    activeCall,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    containerRef,
    availableCameras,
    currentCameraId,
    isScreenSharing,
    remoteIsScreenSharing,
    cameraStreamDuringScreenShare,
    screenShareStream: screenShareStreamRef.current,
    isFullscreen,
    connectionQuality,
    availableMicrophones,
    availableSpeakers,
    currentMicrophoneId,
    currentSpeakerId,
    isSyncingSummary,
    isReconnecting,
    reconnectReason,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleScreenShare,
    toggleFullscreen,
    enumerateCameras,
    enumerateAudioDevices,
    switchMicrophone,
    switchSpeaker,
    isMinimized,
    setIsMinimized,
    // Pre-call preferences
    preCallMuted,
    preCallVideoOff,
    setPreCallMuted,
    setPreCallVideoOff,
    // Link-based calling
    initiateCallViaLink,
    startLinkCallWaiting,
    joinCallViaLink
  }; // End of return
}; // End of useCall

export default useCall;
