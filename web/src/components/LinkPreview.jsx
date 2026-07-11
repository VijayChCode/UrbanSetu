import React, { useState, useEffect } from 'react';
import { FaExternalLinkAlt, FaTimes } from 'react-icons/fa';

const LinkPreview = ({ url, onRemove, className = "", showRemoveButton = true, clickable = true }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ignored, setIgnored] = useState(false);

  const handlePreviewClick = () => {
    if (clickable && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    if (!url) return;

    // Check if it's a likely file reference that shouldn't be previewed
    // We ignore common code/config file extensions if they don't explicitly start with http/https
    // This prevents "filename.js" from being treated as a URL to fetch
    const isCodeFile = /\.(js|jsx|ts|tsx|css|scss|json|map|xml|yml|yaml|md|txt)$/i.test(url);
    const hasProtocol = /^https?:\/\//i.test(url);

    if (isCodeFile && !hasProtocol) {
      setIgnored(true);
      setLoading(false);
      return;
    }

    const fetchPreview = async () => {
      setLoading(true);
      setError(false);

      try {
        let fetchUrl = url;
        if (!hasProtocol) {
          fetchUrl = 'https://' + url;
        }

        // Validate URL object
        try {
          new URL(fetchUrl);
        } catch {
          setError(true);
          setLoading(false);
          return;
        }

        // Use a link preview service (you can replace with your own backend endpoint)
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(fetchUrl)}&meta=true`, {
          timeout: 5000 // 5 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success' && data.data) {
          setPreview({
            title: data.data.title || 'No title available',
            description: data.data.description || 'No description available',
            image: data.data.image?.url || null,
            siteName: data.data.publisher || new URL(fetchUrl).hostname,
            url: fetchUrl
          });
        } else {
          // Fallback: create a basic preview with just the URL
          setPreview({
            title: new URL(fetchUrl).hostname,
            description: fetchUrl,
            image: null,
            siteName: new URL(fetchUrl).hostname,
            url: fetchUrl
          });
        }
      } catch (err) {
        console.error('Error fetching link preview:', err);
        // Fallback: create a basic preview with just the URL
        try {
          const fallbackUrl = hasProtocol ? url : 'https://' + url;
          setPreview({
            title: new URL(fallbackUrl).hostname,
            description: fallbackUrl,
            image: null,
            siteName: new URL(fallbackUrl).hostname,
            url: fallbackUrl
          });
        } catch (urlErr) {
          console.error('Error creating URL object:', urlErr);
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (ignored) return null;

  if (loading) {
    return (
      <div className={`relative bg-gray-100/50 dark:bg-[#1f2c34] border-l-4 border-l-indigo-500 dark:border-l-indigo-400 rounded-r-lg p-3 mb-2 max-w-full shadow-sm ${className}`}>
        <div className="flex items-center space-x-3.5">
          <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700/60 rounded animate-pulse flex-shrink-0"></div>
          <div className="flex-1 min-w-0 max-w-full space-y-2">
            <div className="h-3.5 bg-gray-200 dark:bg-gray-700/60 rounded animate-pulse w-1/3"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700/60 rounded animate-pulse w-3/4"></div>
            <div className="h-2.5 bg-gray-200 dark:bg-gray-700/60 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className={`relative bg-gray-100/50 dark:bg-[#1f2c34] border-l-4 border-l-gray-400 dark:border-l-gray-600 rounded-r-lg p-3 pr-10 mb-2 max-w-full shadow-sm ${className}`}>
        <div className="flex items-center space-x-3.5">
          <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700/60 rounded flex items-center justify-center flex-shrink-0">
            <FaExternalLinkAlt className="text-gray-400 dark:text-gray-500 text-lg" />
          </div>
          <div className="flex-1 min-w-0 max-w-full">
            <div className="text-[13px] text-gray-950 dark:text-gray-100 font-semibold break-all">Link Preview Unavailable</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 break-all mt-1">{url}</div>
          </div>
        </div>
        {onRemove && showRemoveButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-2 right-2 text-gray-400 dark:text-gray-500 hover:text-gray-650 dark:hover:text-gray-300 transition-colors p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700/50 flex-shrink-0 flex items-center justify-center"
            title="Remove preview"
          >
            <FaTimes className="text-[10px]" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative bg-gray-100/50 dark:bg-[#1f2c34] border border-gray-200/40 dark:border-gray-700/40 border-l-4 border-l-indigo-500 dark:border-l-indigo-400 rounded-r-lg p-3 pr-10 mb-2 shadow-sm transition-colors max-w-full ${clickable ? 'cursor-pointer hover:bg-gray-200/50 dark:hover:bg-[#2a3942]' : ''} ${className}`}
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
      <div className="flex items-start space-x-3.5">
        {preview.image && (
          <div className="flex-shrink-0">
            <img
              src={preview.image}
              alt={preview.title}
              className="w-14 h-14 object-cover rounded-md border border-gray-200/20 dark:border-gray-700/20"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 max-w-full">
          <h4 className="text-[13px] font-semibold text-gray-950 dark:text-gray-100 break-all line-clamp-1 tracking-tight leading-snug" title={preview.title}>
            {preview.title}
          </h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 break-all line-clamp-2 tracking-tight leading-normal" title={preview.description}>
            {preview.description}
          </p>
          <div className="flex items-center space-x-1.5 mt-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
            <span className="text-[10px] font-medium uppercase tracking-wider break-all">{preview.siteName}</span>
            <FaExternalLinkAlt className="text-[9px] flex-shrink-0" />
          </div>
        </div>
      </div>
      {onRemove && showRemoveButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 text-gray-400 dark:text-gray-500 hover:text-gray-650 dark:hover:text-gray-300 transition-colors p-1.5 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50 flex-shrink-0 flex items-center justify-center"
          title="Remove preview"
        >
          <FaTimes className="text-[10px]" />
        </button>
      )}
    </div>
  );
};

export default LinkPreview;