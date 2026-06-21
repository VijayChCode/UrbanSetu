import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FaPhone, FaVideo, FaTimes } from 'react-icons/fa';

/**
 * IncomingCallBubble — Draggable floating bubble for minimized incoming calls.
 * Shows a pulsing phone/video icon that can be dragged anywhere on screen.
 * Click opens the incoming call modal; has a small reject button.
 * Supports burst animation on dismiss.
 */
const IncomingCallBubble = ({ callType, callerName, onOpen, onReject }) => {
  const bubbleRef = useRef(null);
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [animState, setAnimState] = useState('entering'); // 'entering' | 'idle' | 'bursting'

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setAnimState('idle'));
  }, []);

  const isVideo = callType === 'video';

  // Burst animation then callback
  const burstAndDo = useCallback((callback) => {
    setAnimState('bursting');
    setTimeout(() => {
      callback();
    }, 400); // Match burst animation duration
  }, []);

  // --- Drag handlers (mouse + touch) ---
  const handlePointerDown = useCallback((e) => {
    if (animState === 'bursting') return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  }, [position, animState]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newX = Math.max(0, Math.min(window.innerWidth - 64, clientX - dragStart.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 64, clientY - dragStart.y));
    setPosition({ x: newX, y: newY });
    setHasDragged(true);
  }, [isDragging, dragStart]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handleClick = () => {
    if (!hasDragged && animState !== 'bursting') {
      burstAndDo(onOpen);
    }
  };

  const handleReject = (e) => {
    e.stopPropagation();
    if (animState !== 'bursting') {
      burstAndDo(onReject);
    }
  };

  return (
    <>
      <style>{`
        @keyframes bubble-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${isVideo ? 'rgba(59,130,246,0.5)' : 'rgba(34,197,94,0.5)'}; }
          50% { box-shadow: 0 0 0 12px ${isVideo ? 'rgba(59,130,246,0)' : 'rgba(34,197,94,0)'}; }
        }
        @keyframes bubble-slide-in {
          from { transform: scale(0.3); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bubble-burst {
          0% { transform: scale(1); opacity: 1; }
          30% { transform: scale(1.3); opacity: 0.8; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes burst-ring {
          0% { transform: scale(1); opacity: 0.6; border-width: 3px; }
          100% { transform: scale(3); opacity: 0; border-width: 0px; }
        }
      `}</style>
      <div
        ref={bubbleRef}
        className="fixed z-[9999] select-none"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transition: isDragging ? 'none' : 'left 0.1s ease, top 0.1s ease',
          touchAction: 'none',
          pointerEvents: animState === 'bursting' ? 'none' : 'auto',
        }}
      >
        {/* Burst ring effect */}
        {animState === 'bursting' && (
          <>
            <div
              className={`absolute inset-0 rounded-full border ${isVideo ? 'border-blue-400' : 'border-green-400'}`}
              style={{ animation: 'burst-ring 0.4s ease-out forwards' }}
            />
            <div
              className={`absolute inset-0 rounded-full border ${isVideo ? 'border-blue-300' : 'border-green-300'}`}
              style={{ animation: 'burst-ring 0.4s ease-out 0.1s forwards' }}
            />
          </>
        )}

        {/* Caller name tooltip */}
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-md pointer-events-none"
          style={{ opacity: animState === 'bursting' ? 0 : 0.9, transition: 'opacity 0.2s' }}
        >
          {callerName || 'Incoming call'}
        </div>

        {/* Main bubble */}
        <div
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onClick={handleClick}
          className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-2xl ${
            isVideo
              ? 'bg-gradient-to-br from-blue-500 to-blue-600'
              : 'bg-gradient-to-br from-green-500 to-green-600'
          }`}
          style={{
            animation: animState === 'bursting'
              ? 'bubble-burst 0.4s ease-in forwards'
              : animState === 'entering'
                ? 'none'
                : 'bubble-slide-in 0.3s ease-out, bubble-pulse 2s ease-in-out 0.3s infinite',
          }}
          title={`${callerName || 'Incoming'} — ${isVideo ? 'Video' : 'Audio'} Call (tap to open)`}
        >
          {isVideo ? (
            <FaVideo className="text-white text-xl" />
          ) : (
            <FaPhone className="text-white text-xl" />
          )}
        </div>

        {/* Small reject button */}
        {animState !== 'bursting' && (
          <button
            onClick={handleReject}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
            title="Reject call"
          >
            <FaTimes className="text-[10px]" />
          </button>
        )}
      </div>
    </>
  );
};

export default IncomingCallBubble;
