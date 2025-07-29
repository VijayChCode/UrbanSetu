import React, { useState, useRef, useEffect } from 'react';
import { FaTimes, FaSearchPlus, FaSearchMinus, FaUndo, FaDownload } from 'react-icons/fa';

const ImagePreview = ({ isOpen, onClose, images, initialIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
          break;
        case '+':
        case '=':
          e.preventDefault();
          setScale(prev => Math.min(prev + 0.5, 5));
          break;
        case '-':
          e.preventDefault();
          setScale(prev => Math.max(prev - 0.5, 0.5));
          break;
        case 'r':
          e.preventDefault();
          setRotation(prev => prev + 90);
          break;
        default:
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, images.length, onClose]);

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  const resetView = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = images[currentIndex];
    link.download = `image-${currentIndex + 1}.jpg`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl z-10 hover:text-gray-300 transition-colors"
      >
        <FaTimes />
      </button>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-2xl z-10 hover:text-gray-300 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={() => setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-2xl z-10 hover:text-gray-300 transition-colors"
          >
            ›
          </button>
        </>
      )}

      {/* Image container */}
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
            cursor: scale > 1 ? 'grab' : 'default'
          }}
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black bg-opacity-50 rounded-lg p-3">
        <button
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.5))}
          className="text-white hover:text-gray-300 transition-colors p-2"
          title="Zoom Out"
        >
          <FaSearchMinus />
        </button>
        <button
          onClick={() => setScale(prev => Math.min(5, prev + 0.5))}
          className="text-white hover:text-gray-300 transition-colors p-2"
          title="Zoom In"
        >
          <FaSearchPlus />
        </button>
        <button
          onClick={() => setRotation(prev => prev + 90)}
          className="text-white hover:text-gray-300 transition-colors p-2"
          title="Rotate"
        >
          <FaUndo />
        </button>
        <button
          onClick={resetView}
          className="text-white hover:text-gray-300 transition-colors p-2"
          title="Reset View"
        >
          Reset
        </button>
        <button
          onClick={downloadImage}
          className="text-white hover:text-gray-300 transition-colors p-2"
          title="Download"
        >
          <FaDownload />
        </button>
      </div>

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
};

export default ImagePreview;