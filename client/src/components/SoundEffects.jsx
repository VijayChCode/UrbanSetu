import React, { useRef, useEffect } from 'react';

// Sound URLs - you can replace these with your own sound files
const SOUNDS = {
  messageSent: '/sounds/message-sent.mp3',
  messageReceived: '/sounds/message-received.mp3',
  notification: '/sounds/notification.mp3',
  typing: '/sounds/typing.mp3'
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
    typing: () => createTone(400, 0.05, 'square')
  };
};

export const useSoundEffects = () => {
  const audioRefs = useRef({});
  const fallbackSounds = useRef(null);
  const isMuted = useRef(false);

  useEffect(() => {
    // Initialize audio elements
    Object.keys(SOUNDS).forEach(soundKey => {
      const audio = new Audio(SOUNDS[soundKey]);
      audio.preload = 'auto';
      audio.volume = 0.6;
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

  const playSound = (soundType) => {
    if (isMuted.current) return;

    try {
      const audio = audioRefs.current[soundType];
      if (audio && audio.readyState >= 2) {
        // Reset audio to start and play
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Fallback to generated sound if audio file fails
          if (fallbackSounds.current && fallbackSounds.current[soundType]) {
            fallbackSounds.current[soundType]();
          }
        });
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
  };

  const toggleMute = () => {
    isMuted.current = !isMuted.current;
    return isMuted.current;
  };

  const setVolume = (volume) => {
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.volume = Math.max(0, Math.min(1, volume));
      }
    });
  };

  return {
    playMessageSent: () => playSound('messageSent'),
    playMessageReceived: () => playSound('messageReceived'),
    playNotification: () => playSound('notification'),
    playTyping: () => playSound('typing'),
    toggleMute,
    setVolume,
    isMuted: () => isMuted.current
  };
};

// Sound Control Component
export const SoundControl = ({ onToggleMute, isMuted, onVolumeChange }) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
      <button
        onClick={onToggleMute}
        className={`p-2 rounded-full transition-colors ${
          isMuted ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        }`}
        title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {isMuted ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        defaultValue="0.6"
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        disabled={isMuted}
      />
    </div>
  );
};

export default useSoundEffects;