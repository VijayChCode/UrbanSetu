import React, { useState, useEffect } from 'react';
import { FaExternalLinkAlt, FaTimes, FaGlobe } from 'react-icons/fa';

// Global cache for link previews to prevent redundant network requests and 429 rate limit issues
const previewCache = new Map();

const getDomain = (urlStr) => {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return urlStr;
  }
};

const getGoogleFavicon = (domain) => {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
};

const getInternalAppPreview = (fetchUrl, hostname) => {
  const isVideoCall = fetchUrl.includes('/call/video/') || fetchUrl.includes('/call/');
  const domain = getDomain(fetchUrl);
  const favicon = getGoogleFavicon(domain) || '/favicon.ico';

  if (isVideoCall) {
    return {
      title: "UrbanSetu Video Call Link",
      description: "Click to join the video consultation room",
      image: favicon,
      siteName: domain || "urbansetu.vercel.app",
      url: fetchUrl,
      isInternal: true
    };
  }

  return {
    title: domain || "UrbanSetu",
    description: fetchUrl,
    image: favicon,
    siteName: domain || "urbansetu.vercel.app",
    url: fetchUrl,
    isInternal: true
  };
};

const LinkPreview = ({ url, onRemove, className = "", showRemoveButton = true, clickable = true, isSentMessage = false }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);

  const handlePreviewClick = () => {
    if (clickable && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    if (!url) return;

    // Check if it's a likely file reference that shouldn't be previewed
    const isCodeFile = /\.(js|jsx|ts|tsx|css|scss|json|map|xml|yml|yaml|md|txt)$/i.test(url);
    const hasProtocol = /^https?:\/\//i.test(url);

    if (isCodeFile && !hasProtocol) {
      setIgnored(true);
      setLoading(false);
      return;
    }

    let fetchUrl = url;
    if (!hasProtocol) {
      fetchUrl = 'https://' + url;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(fetchUrl);
    } catch {
      setError(true);
      setLoading(false);
      return;
    }

    const hostname = parsedUrl.hostname;
    const domain = getDomain(fetchUrl);
    const googleFavicon = getGoogleFavicon(domain);

    // Check in-memory cache first
    if (previewCache.has(fetchUrl)) {
      const cached = previewCache.get(fetchUrl);
      setPreview(cached);
      setImgSrc(cached.image || cached.fallbackFavicon || googleFavicon);
      setImgFailed(false);
      setLoading(false);
      return;
    }

    // Check if internal app link (UrbanSetu or current window domain or localhost)
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const isInternal = hostname.includes('urbansetu') || 
                       (currentHost && hostname === currentHost) || 
                       hostname === 'localhost' || 
                       hostname === '127.0.0.1';

    if (isInternal) {
      const internalPreview = getInternalAppPreview(fetchUrl, hostname);
      previewCache.set(fetchUrl, internalPreview);
      setPreview(internalPreview);
      setImgSrc(internalPreview.image);
      setImgFailed(false);
      setLoading(false);
      return;
    }

    const fetchPreview = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(fetchUrl)}&meta=true`);

        if (response.ok) {
          const data = await response.json();

          if (data.status === 'success' && data.data) {
            const bestImage = data.data.image?.url || data.data.logo?.url || googleFavicon;
            const result = {
              title: data.data.title || domain,
              description: data.data.description || fetchUrl,
              image: bestImage,
              siteName: data.data.publisher || domain,
              url: fetchUrl,
              fallbackFavicon: googleFavicon
            };
            previewCache.set(fetchUrl, result);
            setPreview(result);
            setImgSrc(bestImage);
            setImgFailed(false);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Silently catch fetch errors (including 429 rate limits) to avoid red console errors
      }

      // Fallback: Create preview using domain title and Google Favicon
      const fallbackResult = {
        title: domain,
        description: fetchUrl,
        image: googleFavicon,
        siteName: domain,
        url: fetchUrl,
        fallbackFavicon: googleFavicon
      };
      previewCache.set(fetchUrl, fallbackResult);
      setPreview(fallbackResult);
      setImgSrc(googleFavicon);
      setImgFailed(false);
      setLoading(false);
    };

    fetchPreview();
  }, [url]);

  const handleImageError = () => {
    if (preview?.fallbackFavicon && imgSrc !== preview.fallbackFavicon) {
      setImgSrc(preview.fallbackFavicon);
    } else {
      setImgFailed(true);
    }
  };

  if (ignored) return null;

  if (loading) {
    return (
      <div className={`relative ${
        isSentMessage
          ? 'bg-white/10 border-l-4 border-l-white/60 text-white'
          : 'bg-gray-100/50 dark:bg-[#1f2c34] border-l-4 border-l-indigo-500 dark:border-l-indigo-400'
      } rounded-r-lg p-3 mb-2 max-w-full shadow-sm ${className}`}>
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 ${isSentMessage ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700/60'} rounded-lg animate-pulse flex-shrink-0`}></div>
          <div className="flex-1 min-w-0 max-w-full space-y-2">
            <div className={`h-3.5 ${isSentMessage ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700/60'} rounded animate-pulse w-1/3`}></div>
            <div className={`h-3 ${isSentMessage ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700/60'} rounded animate-pulse w-3/4`}></div>
            <div className={`h-2.5 ${isSentMessage ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700/60'} rounded animate-pulse w-1/2`}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className={`relative ${
        isSentMessage
          ? 'bg-white/10 border-l-4 border-l-white/40 text-white'
          : 'bg-gray-100/50 dark:bg-[#1f2c34] border-l-4 border-l-gray-400 dark:border-l-gray-600'
      } rounded-r-lg p-3 pr-10 mb-2 max-w-full shadow-sm ${className}`}>
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 ${isSentMessage ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700/60'} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <FaExternalLinkAlt className={`${isSentMessage ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'} text-lg`} />
          </div>
          <div className="flex-1 min-w-0 max-w-full">
            <div className={`text-[13px] font-semibold break-all ${isSentMessage ? 'text-white' : 'text-gray-950 dark:text-gray-100'}`}>Link Preview Unavailable</div>
            <div className={`text-[11px] break-all mt-1 ${isSentMessage ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{url}</div>
          </div>
        </div>
        {onRemove && showRemoveButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={`absolute top-2 right-2 ${isSentMessage ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-gray-400 dark:text-gray-500 hover:text-gray-650 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50'} transition-colors p-1.5 rounded-full flex-shrink-0 flex items-center justify-center`}
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
      className={`relative ${
        isSentMessage
          ? 'bg-black/15 border border-white/15 border-l-4 border-l-white/75 text-white'
          : 'bg-gray-100/50 dark:bg-[#1f2c34] border border-gray-200/40 dark:border-gray-700/40 border-l-4 border-l-indigo-500 dark:border-l-indigo-400'
      } rounded-r-lg p-3 pr-10 mb-2 shadow-sm transition-colors max-w-full ${
        clickable ? (isSentMessage ? 'cursor-pointer hover:bg-black/25' : 'cursor-pointer hover:bg-gray-200/50 dark:hover:bg-[#2a3942]') : ''
      } ${className}`}
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
        {!imgFailed && imgSrc ? (
          <div className="flex-shrink-0">
            <img
              src={imgSrc}
              alt={preview.title}
              className={`w-12 h-12 object-contain rounded-lg p-1 border shadow-xs ${
                isSentMessage
                  ? 'border-white/20 bg-white/10'
                  : 'border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800'
              }`}
              onError={handleImageError}
            />
          </div>
        ) : (
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border shadow-xs ${
            isSentMessage
              ? 'bg-white/15 border-white/20 text-white'
              : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400'
          }`}>
            <FaGlobe className="text-xl" />
          </div>
        )}
        <div className="flex-1 min-w-0 max-w-full">
          <h4 className={`text-[13px] font-semibold break-all line-clamp-1 tracking-tight leading-snug ${
            isSentMessage ? 'text-white' : 'text-gray-950 dark:text-gray-100'
          }`} title={preview.title}>
            {preview.title}
          </h4>
          <p className={`text-[11px] mt-1 break-all line-clamp-2 tracking-tight leading-normal ${
            isSentMessage ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
          }`} title={preview.description}>
            {preview.description}
          </p>
          <div className={`flex items-center space-x-1.5 mt-1.5 ${
            isSentMessage ? 'text-white/60 hover:text-white/85' : 'text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400'
          } transition-colors`}>
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
          className={`absolute top-2 right-2 ${
            isSentMessage
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-650 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
          } transition-colors p-1.5 rounded-full flex-shrink-0 flex items-center justify-center`}
          title="Remove preview"
        >
          <FaTimes className="text-[10px]" />
        </button>
      )}
    </div>
  );
};

export default LinkPreview;