import React, { useEffect, useState, useCallback } from 'react';

// Unified media preview for chat: supports images and videos in a single sequence
// media: Array<{ type: 'image'|'video', url: string }>
const ChatMediaPreview = ({ isOpen, onClose, media = [], initialIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [isKeybound, setIsKeybound] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex || 0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialIndex]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : (media.length > 0 ? media.length - 1 : 0)));
  }, [media.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  }, [media.length]);

  useEffect(() => {
    if (!isOpen || isKeybound) return;
    const onKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    setIsKeybound(true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      setIsKeybound(false);
    };
  }, [isOpen, goPrev, goNext, onClose, isKeybound]);

  if (!isOpen || !media || media.length === 0) return null;

  const item = media[currentIndex];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-red-400 bg-black/70 rounded-full p-3 transition-all duration-200 hover:bg-black/90 hover:scale-110"
      >
        ✕
      </button>

      {media.length > 1 && (
        <>
          <button
            aria-label="Previous"
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-blue-300 bg-black/70 rounded-full p-4 transition-all duration-200 hover:bg-black/90 hover:scale-110"
          >
            ‹
          </button>
          <button
            aria-label="Next"
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-blue-300 bg-black/70 rounded-full p-4 transition-all duration-200 hover:bg-black/90 hover:scale-110"
          >
            ›
          </button>
        </>
      )}

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/60 px-3 py-1 rounded-full">
        {currentIndex + 1} / {media.length}
      </div>

      <div className="relative w-full h-full max-h-[92vh] flex items-center justify-center p-4">
        {item?.type === 'video' ? (
          <video
            key={`video-${currentIndex}`}
            src={item.url}
            className="w-full h-full max-h-[92vh] object-contain rounded"
            controls
            autoPlay
          />
        ) : (
          <img
            key={`image-${currentIndex}`}
            src={item?.url}
            alt="Chat media"
            className="w-full h-full max-h-[92vh] object-contain rounded"
            onError={(e) => {
              e.currentTarget.src = 'https://via.placeholder.com/800x600?text=Media+Not+Available';
              e.currentTarget.className = 'w-full h-full max-h-[92vh] object-contain rounded opacity-60';
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ChatMediaPreview;

