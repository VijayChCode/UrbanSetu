import React, { useState, useEffect } from 'react';
import { FaExternalLinkAlt, FaTimes, FaGlobe } from 'react-icons/fa';

// Global cache for link previews to prevent redundant network requests and 429 rate limit issues
const previewCache = new Map();

const getStoredPreview = (url) => {
  try {
    const raw = localStorage.getItem(`urbansetu_link_prev_${url}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const setStoredPreview = (url, data) => {
  try {
    localStorage.setItem(`urbansetu_link_prev_${url}`, JSON.stringify(data));
  } catch {}
};

const COMMON_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'io', 'app', 'dev', 'co', 'in', 
  'uk', 'us', 'ca', 'de', 'fr', 'jp', 'cn', 'ru', 'br', 'au', 'info', 'biz', 
  'me', 'tv', 'site', 'online', 'tech', 'store', 'agency', 'xyz', 'ai', 'cloud',
  'link', 'live', 'digital', 'global', 'space', 'website', 'cc', 'to', 'pro'
]);

const isValidDomain = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return false;
  const clean = hostname.split(':')[0].toLowerCase();

  if (clean === 'localhost' || clean === '127.0.0.1') return true;
  if (clean.includes('urbansetu')) return true;

  const parts = clean.split('.');
  if (parts.length < 2) return false;

  const tld = parts[parts.length - 1];
  
  // TLD must be purely alphabetic (2-24 chars)
  if (!/^[a-z]{2,24}$/.test(tld)) return false;

  // 2-letter TLDs (country codes like .in, .uk, .co) or known TLDs are valid
  if (tld.length === 2 || COMMON_TLDS.has(tld)) return true;

  // If part of multi-subdomain like foo.bar.com
  if (parts.length >= 3 && COMMON_TLDS.has(tld)) return true;

  return false;
};

const getDomain = (urlStr) => {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return urlStr;
  }
};

const getGoogleFavicon = (domain) => {
  if (!domain || !isValidDomain(domain)) return null;
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
    const validDomain = isValidDomain(hostname);

    // If domain is invalid / incomplete (e.g. "web.whatsapp" before ".com" is typed), skip API fetch & favicon image
    if (!validDomain) {
      const basicPreview = {
        title: domain,
        description: fetchUrl,
        image: null,
        siteName: domain,
        url: fetchUrl
      };
      setPreview(basicPreview);
      setImgSrc(null);
      setImgFailed(true);
      setLoading(false);
      return;
    }

    // Check in-memory cache first
    if (previewCache.has(fetchUrl)) {
      const cached = previewCache.get(fetchUrl);
      setPreview(cached);
      setImgSrc(cached.image || null);
      setImgFailed(!cached.image);
      setLoading(false);
      return;
    }

    // Check persistent localStorage cache next
    const stored = getStoredPreview(fetchUrl);
    if (stored) {
      previewCache.set(fetchUrl, stored);
      setPreview(stored);
      setImgSrc(stored.image || null);
      setImgFailed(!stored.image);
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
      setStoredPreview(fetchUrl, internalPreview);
      setPreview(internalPreview);
      setImgSrc(internalPreview.image);
      setImgFailed(!internalPreview.image);
      setLoading(false);
      return;
    }

    // Debounce API requests by 400ms to prevent rapid keypress rate limit errors while typing
    const timerId = setTimeout(async () => {
      setLoading(true);
      setError(false);

      // Attempt 1: Microlink API
      try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(fetchUrl)}&meta=true`);

        if (response.ok) {
          const data = await response.json();

          if (data.status === 'success' && data.data) {
            const bestImage = data.data.image?.url || data.data.logo?.url || getGoogleFavicon(domain);
            const result = {
              title: data.data.title || domain,
              description: data.data.description || fetchUrl,
              image: bestImage,
              siteName: data.data.publisher || domain,
              url: fetchUrl
            };
            previewCache.set(fetchUrl, result);
            setStoredPreview(fetchUrl, result);
            setPreview(result);
            setImgSrc(bestImage);
            setImgFailed(!bestImage);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Silently continue to fallback API on 429 rate limit or network error
      }

      // Attempt 2: Dub.co Metatags API (Secondary free metadata API)
      try {
        const dubRes = await fetch(`https://api.dub.co/metatags?url=${encodeURIComponent(fetchUrl)}`);
        if (dubRes.ok) {
          const dubData = await dubRes.json();
          if (dubData && (dubData.title || dubData.image)) {
            const bestImage = dubData.image || getGoogleFavicon(domain);
            const result = {
              title: dubData.title || domain,
              description: dubData.description || fetchUrl,
              image: bestImage,
              siteName: domain,
              url: fetchUrl
            };
            previewCache.set(fetchUrl, result);
            setStoredPreview(fetchUrl, result);
            setPreview(result);
            setImgSrc(bestImage);
            setImgFailed(!bestImage);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Silently continue to Google Favicon fallback
      }

      // Attempt 3: Google Favicon API Fallback (Guaranteed to work without 429 rate limits)
      const googleFavicon = getGoogleFavicon(domain);
      const fallbackResult = {
        title: domain,
        description: fetchUrl,
        image: googleFavicon,
        siteName: domain,
        url: fetchUrl
      };
      previewCache.set(fetchUrl, fallbackResult);
      setStoredPreview(fetchUrl, fallbackResult);
      setPreview(fallbackResult);
      setImgSrc(googleFavicon);
      setImgFailed(!googleFavicon);
      setLoading(false);
    }, 400);

    return () => clearTimeout(timerId);
  }, [url]);

  const handleImageError = () => {
    setImgFailed(true);
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