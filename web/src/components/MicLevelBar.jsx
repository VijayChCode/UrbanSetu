import React, { useEffect, useRef, useState } from 'react';

/**
 * MicLevelBar — Real-time microphone audio level visualizer.
 * 
 * Props:
 *   stream    – MediaStream with audio tracks
 *   barCount  – Number of bars to render (default 5)
 *   height    – CSS height string (default '32px')
 *   theme     – 'light' | 'dark' (default 'dark')
 *   muted     – If true, shows muted state (bars grayed out, no animation)
 */
const MicLevelBar = ({ stream, barCount = 5, height = '32px', theme = 'dark', muted = false }) => {
  const [level, setLevel] = useState(0);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!stream || muted) {
      setLevel(0);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    let audioContext;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        // Compute average volume (0-255)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Normalize to 0-1
        setLevel(Math.min(avg / 128, 1));
        rafRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (err) {
      console.error('[MicLevelBar] Error creating audio context:', err);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch (e) { /* ignore */ }
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
      }
      analyserRef.current = null;
      audioContextRef.current = null;
      sourceRef.current = null;
    };
  }, [stream, muted]);

  const bars = Array.from({ length: barCount }, (_, i) => {
    const threshold = (i + 1) / barCount;
    const isActive = !muted && level >= threshold * 0.6;
    return { index: i, isActive, threshold };
  });

  const activeColor = theme === 'dark' ? 'bg-green-400' : 'bg-green-500';
  const inactiveColor = theme === 'dark' ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-600';
  const mutedColor = theme === 'dark' ? 'bg-red-500/40' : 'bg-red-300 dark:bg-red-800/40';

  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height }}>
      {bars.map(({ index, isActive }) => {
        const barHeight = `${30 + (index + 1) * (70 / barCount)}%`;
        return (
          <div
            key={index}
            className={`rounded-full transition-all duration-150 ${
              muted
                ? mutedColor
                : isActive
                  ? activeColor
                  : inactiveColor
            }`}
            style={{
              width: '4px',
              height: isActive ? barHeight : '20%',
              transition: 'height 0.1s ease, background-color 0.2s ease',
            }}
          />
        );
      })}
    </div>
  );
};

export default MicLevelBar;
