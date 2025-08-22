import React, { useState, useEffect } from 'react';
import { FaExternalLinkAlt, FaTimes } from 'react-icons/fa';

const LinkPreview = ({ url, onRemove, className = "", showRemoveButton = true, clickable = true }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handlePreviewClick = () => {
    if (clickable && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    if (!url) return;

    const fetchPreview = async () => {
      setLoading(true);
      setError(false);
      
      try {
        // Use a link preview service (you can replace with your own backend endpoint)
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`);
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
          setPreview({
            title: data.data.title || 'No title available',
            description: data.data.description || 'No description available',
            image: data.data.image?.url || null,
            siteName: data.data.publisher || new URL(url).hostname,
            url: url
          });
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching link preview:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-16 h-16 bg-gray-200 rounded animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
              <FaExternalLinkAlt className="text-gray-400 text-xl" />
            </div>
            <div>
              <div className="text-sm text-gray-600 font-medium">Link Preview Unavailable</div>
              <div className="text-xs text-gray-500 truncate max-w-xs">{url}</div>
            </div>
          </div>
                      {onRemove && showRemoveButton && (
              <button
                onClick={onRemove}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes className="text-sm" />
              </button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2 hover:border-gray-300 transition-colors ${clickable ? 'cursor-pointer hover:bg-gray-100' : ''} ${className}`}
      onClick={clickable ? handlePreviewClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlePreviewClick();
        }
      } : undefined}
    >
      <div className="flex items-start space-x-3">
        {preview.image && (
          <div className="flex-shrink-0">
            <img
              src={preview.image}
              alt={preview.title}
              className="w-16 h-16 object-cover rounded"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate" title={preview.title}>
                {preview.title}
              </h4>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2" title={preview.description}>
                {preview.description}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-xs text-gray-500">{preview.siteName}</span>
                <FaExternalLinkAlt className="text-xs text-gray-400" />
              </div>
            </div>
            {onRemove && showRemoveButton && (
              <button
                onClick={onRemove}
                className="text-gray-600 transition-colors ml-2"
              >
                <FaTimes className="text-sm" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkPreview;