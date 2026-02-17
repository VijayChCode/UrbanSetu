import React, { useRef, useState, useEffect } from 'react';
import { FaEraser, FaUndo, FaCheck, FaTimes, FaPen } from 'react-icons/fa';

export default function DigitalSignature({
  onSign,
  onCancel,
  title = 'Sign Here',
  userName,
  disabled = false,
  existingSignature = null
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load existing signature if provided
    if (existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
        setSignatureData(canvas.toDataURL());
      };
      img.src = existingSignature;
    }
  }, [existingSignature]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      // Touch event
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    } else {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
    setSignatureData(canvasRef.current.toDataURL());
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureData(null);
  };

  const handleSignClick = () => {
    if (!hasSignature || !signatureData) {
      return;
    }
    setShowPreview(true);
  };

  const confirmSignature = () => {
    if (onSign) {
      onSign(signatureData);
    }
    setShowPreview(false);
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-700 p-4">
        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-1 dark:text-white">{title}</h3>
          {userName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{userName}</p>
          )}
        </div>

        {/* Canvas Signature Pad */}
        <div className="relative mb-4 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-lg bg-gray-50 dark:bg-white">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="w-full h-48 touch-none cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-sm">Draw your signature above</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={clearSignature}
              disabled={!hasSignature || disabled}
              className="px-3 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              title="Clear signature"
            >
              <FaEraser /> Clear
            </button>
          </div>

          <div className="flex gap-2">
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={disabled}
                className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FaTimes /> Cancel
              </button>
            )}
            <button
              onClick={handleSignClick}
              disabled={!hasSignature || disabled}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FaCheck /> Confirm Signature
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          By signing, you agree to the terms and conditions of the contract
        </p>
      </div>

      {/* Signature Confirmation Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-scale-in border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Confirm Signature</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
              Please verify your signature below before proceeding.
            </p>

            <div className="bg-gray-50 dark:bg-white border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-lg p-4 mb-6 flex justify-center">
              <img src={signatureData} alt="Signature Preview" className="max-h-32 object-contain" />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <FaUndo className="inline mr-2" /> Edit
              </button>
              <button
                onClick={confirmSignature}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FaCheck /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

