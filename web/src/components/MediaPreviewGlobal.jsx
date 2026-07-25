import React, { useState, useEffect } from 'react';
import VideoPreview from './VideoPreview';

const MediaPreviewGlobal = () => {
    const [state, setState] = useState({ isOpen: false, videos: [], index: 0 });

    useEffect(() => {
        const handleOpen = (e) => {
            // Pause any playing audio elements on the page when opening video preview
            document.querySelectorAll('audio').forEach(audioEl => {
                if (!audioEl.paused) {
                    audioEl.pause();
                }
            });
            // Ensure we extract detail correctly for CustomEvent
            const { videos, index } = e.detail || {};
            if (videos) {
                setState({ isOpen: true, videos, index: index || 0 });
            }
        };

        window.addEventListener('open-media-preview', handleOpen);
        return () => window.removeEventListener('open-media-preview', handleOpen);
    }, []);

    // Return null if not open, BUT we must ensure VideoPreview handles "if (!isOpen) return null" internally too
    // if we want animations. VideoPreview currently returns null if !isOpen.
    // We can render it conditionally here to be safe and save resources.
    if (!state.isOpen) return null;

    return (
        <VideoPreview
            isOpen={state.isOpen}
            onClose={() => setState(prev => ({ ...prev, isOpen: false }))}
            videos={state.videos}
            initialIndex={state.index}
        />
    );
};

export default MediaPreviewGlobal;
