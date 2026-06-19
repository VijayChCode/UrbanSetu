import React, { useRef, useEffect } from 'react';

// Sound URLs - you can replace these with your own sound files
const SOUNDS = {
  messageSent: '/assets/sounds/message-sent.mp3',
  messageReceived: '/assets/sounds/message-received.mp3',
  notification: '/assets/sounds/notification.mp3',
  typing: '/assets/sounds/typing.mp3',
  calling: '/assets/sounds/Dailing.mp3',
  ringtone: '/assets/sounds/ringtone.mp3',
  endCall: '/assets/sounds/endcall.mp3'
};

// Fallback sounds using Web Audio API if files aren't available
const createFallbackSounds = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  const createTone = (frequency, duration, type = 'sine') => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  };
  
  return {
    messageSent: () => createTone(800, 0.1, 'sine'),
    messageReceived: () => createTone(600, 0.15, 'sine'),
    notification: () => {
      createTone(800, 0.1, 'sine');
      setTimeout(() => createTone(1000, 0.1, 'sine'), 100);
    },
    typing: () => createTone(400, 0.05, 'square'),
    calling: () => createTone(500, 0.3, 'sine'),
    ringtone: () => {
      createTone(600, 0.2, 'sine');
      setTimeout(() => createTone(800, 0.2, 'sine'), 200);
    },
    endCall: () => createTone(400, 0.2, 'sine')
  };
};

export const useSoundEffects = () => {
  const audioRefs = useRef({});
  const fallbackSounds = useRef(null);
  const isMuted = useRef(false);
  const currentVolume = useRef(1.0); // Default volume

  useEffect(() => {
    // Initialize audio elements
    Object.keys(SOUNDS).forEach(soundKey => {
      const audio = new Audio(SOUNDS[soundKey]);
      audio.preload = 'auto';
      audio.volume = 1.0;
      audioRefs.current[soundKey] = audio;
    });

    // Initialize fallback sounds
    fallbackSounds.current = createFallbackSounds();

    // Cleanup
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  const playSound = (soundType, loop = false) => {
    if (isMuted.current) return;

    try {
      const audio = audioRefs.current[soundType];
      if (audio && audio.readyState >= 2) {
        // Reset audio to start and play
        audio.currentTime = 0;
        audio.loop = loop;
        audio.play().catch(() => {
          // Fallback to generated sound if audio file fails
          if (fallbackSounds.current && fallbackSounds.current[soundType]) {
            fallbackSounds.current[soundType]();
          }
        });
        return audio;
      } else if (fallbackSounds.current && fallbackSounds.current[soundType]) {
        // Use fallback sound
        fallbackSounds.current[soundType]();
      }
    } catch (error) {
      console.warn('Sound playback failed:', error);
      // Use fallback sound
      if (fallbackSounds.current && fallbackSounds.current[soundType]) {
        fallbackSounds.current[soundType]();
      }
    }
    return null;
  };

  const stopSound = (soundType) => {
    try {
      const audio = audioRefs.current[soundType];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.loop = false;
      }
    } catch (error) {
      console.warn('Sound stop failed:', error);
    }
  };

  const toggleMute = (skipAudioElements = false) => {
    isMuted.current = !isMuted.current;
    
    // Mute/unmute all audio message elements in the chat (unless skipped to prevent circular updates)
    if (!skipAudioElements) {
      document.querySelectorAll('audio[data-audio-id]').forEach(audioEl => {
        if (audioEl) {
          audioEl.muted = isMuted.current;
        }
      });
    }
    
    return isMuted.current;
  };

  const setVolume = (volume, skipAudioElements = false) => {
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    currentVolume.current = normalizedVolume;
    
    // Set volume for notification sounds
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.volume = normalizedVolume;
      }
    });
    
    // Set volume for all audio message elements in the chat (unless skipped to prevent circular updates)
    if (!skipAudioElements) {
      document.querySelectorAll('audio[data-audio-id]').forEach(audioEl => {
        if (audioEl) {
          audioEl.volume = normalizedVolume;
        }
      });
    }
  };

  return {
    playMessageSent: () => playSound('messageSent'),
    playMessageReceived: () => playSound('messageReceived'),
    playNotification: () => playSound('notification'),
    playTyping: () => playSound('typing'),
    playCalling: () => playSound('calling', true), // Loop calling sound
    playRingtone: () => playSound('ringtone', true), // Loop ringtone sound
    playEndCall: () => playSound('endCall', false), // Play once
    stopCalling: () => stopSound('calling'),
    stopRingtone: () => stopSound('ringtone'),
    toggleMute,
    setVolume,
    isMuted: () => isMuted.current,
    getCurrentVolume: () => currentVolume.current
  };
};

// Sound Control Component
export const SoundControl = ({ onToggleMute, isMuted, onVolumeChange, currentVolume = 1.0 }) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg">
      <button
        onClick={onToggleMute}
        className={`p-2 rounded-full transition-colors ${
          isMuted ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-white/20 text-white hover:bg-white/30'
        }`}
        title={isMuted ? 'Unmute all sounds (notifications & audio messages)' : 'Mute all sounds (notifications & audio messages)'}
      >
        {isMuted ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 8.929a1 1 0 010 1.414A1.5 1.5 0 0116 12a1 1 0 102 0 3.5 3.5 0 00-1.929-3.071z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      
      <div className="flex flex-col items-center gap-1">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={currentVolume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-20 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider accent-white"
          disabled={isMuted}
          title={`Volume: ${Math.round(currentVolume * 100)}% (affects notifications & audio messages)`}
        />
        <span className="text-xs text-white/80 font-medium">
          {Math.round(currentVolume * 100)}%
        </span>
      </div>
    </div>
  );
};

export default useSoundEffects;