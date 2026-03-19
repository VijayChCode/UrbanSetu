import React, { useState, useEffect, useRef } from 'react';

// Helper function to process text segments for links, mentions, and search highlighting
const processTextSegment = (text, isSentMessage, searchQuery) => {
  if (!text) return null;

  // Regex patterns
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  // Improved MD link regex to better handle brackets and avoid capturing trailing text
  // Matches: [Text](URL)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  // URL regex for raw links (http/https/www)
  const urlRegex = /(https?:\/\/[^\s\)]+|www\.[^\s\)]+\.[^\s\)]+)/gi;

  // First, handle property mentions
  let processedText = text;
  const mentionMatches = [...text.matchAll(mentionRegex)];

  const mentionPlaceholders = [];
  mentionMatches.forEach((match, index) => {
    const [full, name, listingId] = match;
    const placeholder = `__MENTION_${index}__`;
    processedText = processedText.replace(full, placeholder);
    mentionPlaceholders.push({ placeholder, name, listingId, full });
  });

  // Second, handle standard Markdown links [Link Text](URL)
  // We process this BEFORE raw URLs to avoid double-processing
  const mdLinkMatches = [...processedText.matchAll(mdLinkRegex)];
  const mdLinkPlaceholders = [];
  mdLinkMatches.forEach((match, index) => {
    const [full, linkText, linkUrl] = match;
    const placeholder = `__MDLINK_${index}__`;
    processedText = processedText.replace(full, placeholder);
    mdLinkPlaceholders.push({ placeholder, linkText, linkUrl });
  });

  // Third, handle raw URLs that aren't part of markdown links
  const urlMatches = [...processedText.matchAll(urlRegex)];
  const urlPlaceholders = [];
  urlMatches.forEach((match, index) => {
    const [url] = match;
    // Basic check to strip trailing punctuation often found in text (.,!?)
    let cleanUrl = url;
    const trailing = cleanUrl.match(/[.,!?)]+$/);
    if (trailing) {
      cleanUrl = cleanUrl.substring(0, cleanUrl.length - trailing[0].length);
    }

    // Only process if it looks like a valid URL or domain
    if (cleanUrl.length > 4) {
      const placeholder = `__URL_${index}__`;
      // Use replace with a check to ensure we only replace the specific instance if needed, 
      // but simple replace works because unique placeholders.
      // However, we must be careful not to replace parts of already placeholder'd text.
      // Since placeholders are __XYZ__, they won't match urlRegex easily (no dots usually).
      processedText = processedText.replace(url, placeholder + (trailing ? trailing[0] : ''));
      urlPlaceholders.push({ placeholder, url: cleanUrl });
    }
  });

  // Split by placeholders
  const allPlaceholders = [...mentionPlaceholders, ...mdLinkPlaceholders, ...urlPlaceholders];
  let parts;
  if (allPlaceholders.length > 0) {
    const placeholderRegex = new RegExp(`(${allPlaceholders.map(p => p.placeholder).join('|')})`, 'g');
    parts = processedText.split(placeholderRegex);
  } else {
    parts = [processedText];
  }

  return parts.map((subPart, index) => {
    if (!subPart) return null;

    // Check if it's a placeholder
    const mentionPlaceholder = mentionPlaceholders.find(p => p.placeholder === subPart);
    if (mentionPlaceholder) {
      const { name, listingId } = mentionPlaceholder;
      let href = "#";
      let basePrefix = "";

      const isAdmin = window.location.pathname.includes('/admin');

      // Check for type prefix in the ID
      if (listingId.startsWith('blog:')) {
        const id = listingId.split(':')[1];
        basePrefix = isAdmin ? '/admin/blog/' : '/user/blog/';
        href = `${basePrefix}${id}`;
      } else if (listingId.startsWith('guide:')) {
        const id = listingId.split(':')[1];
        basePrefix = isAdmin ? '/admin/guide/' : '/user/guide/';
        href = `${basePrefix}${id}`;
      } else if (listingId.startsWith('listing:') || listingId.startsWith('prop:')) {
        const id = listingId.split(':')[1];
        basePrefix = isAdmin ? '/admin/listing/' : '/user/listing/';
        href = `${basePrefix}${id}`;
      } else {
        // Legacy or default: assume property listing
        basePrefix = isAdmin ? '/admin/listing/' : '/user/listing/';
        href = `${basePrefix}${listingId}`;
      }

      const linkClasses = isSentMessage
        ? "text-white underline decoration-dotted hover:text-blue-200 cursor-pointer"
        : "text-blue-600 underline decoration-dotted hover:text-blue-800 cursor-pointer";

      return (
        <a
          key={`mention-${index}`}
          href={href}
          onClick={(e) => {
            // Ensure propagation stopped for modal/overlay contexts, but allow navigation
            e.stopPropagation();
          }}
          className={linkClasses}
          title={`Open ${name}`}
        >
          @{name}
        </a>
      );
    }

    const mdLinkPlaceholder = mdLinkPlaceholders.find(p => p.placeholder === subPart);
    if (mdLinkPlaceholder) {
      const { linkText, linkUrl } = mdLinkPlaceholder;
      let finalUrl = linkUrl;
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('/')) {
        finalUrl = 'https://' + finalUrl;
      }

      // Determine if internal or external
      const isInternal = finalUrl.startsWith('/') || finalUrl.includes('urbansetu.vercel.app') || finalUrl.includes('urbansetuglobal.onrender.com');

      const linkClasses = isSentMessage
        ? "text-white hover:text-blue-200 underline cursor-pointer font-medium"
        : "text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium";

      return (
        <a
          key={`mdlink-${index}`}
          href={finalUrl}
          target={isInternal ? "_self" : "_blank"}
          rel={isInternal ? "" : "noopener noreferrer"}
          className={linkClasses}
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </a>
      );
    }

    const urlPlaceholder = urlPlaceholders.find(p => p.placeholder === subPart);
    if (urlPlaceholder) {
      const { url } = urlPlaceholder;
      let finalUrl = url;
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }

      const linkClasses = isSentMessage
        ? "text-white hover:text-blue-200 underline transition-colors duration-200 cursor-pointer"
        : "text-blue-600 hover:text-blue-800 underline transition-colors duration-200 cursor-pointer";

      return (
        <a
          key={`url-${index}`}
          href={finalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    }

    // Check for search highlighting
    if (searchQuery && searchQuery.trim()) {
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const searchParts = subPart.split(regex);

      return searchParts.map((searchPart, searchIndex) => {
        if (regex.test(searchPart)) {
          return (
            <span key={`search-${index}-${searchIndex}`} className="search-text-highlight bg-yellow-200 text-black px-1 rounded">
              {searchPart}
            </span>
          );
        }
        return searchPart;
      });
    }

    return subPart;
  });
};

// Utility function to format markdown text
// Now also handles links, mentions, and search highlighting
const formatText = (text, isSentMessage = false, searchQuery = "") => {
  if (!text || typeof text !== 'string') return text;

  const lines = text.split('\n');
  const result = [];

  lines.forEach((line, lineIndex) => {
    if (!line || typeof line !== 'string') {
      return;
    }

    // Check if this is a list item first
    const isNumberedList = line.trim().match(/^(\d+)\.\s+/);
    const isBulletList = line.trim().match(/^[-•]\s+/);
    const isQuote = line.trim().match(/^>\s+/);

    if (isNumberedList || isBulletList) {
      // For list items, only process the content part
      let content = '';
      let prefix = '';
      let indent = '';

      if (isNumberedList) {
        const listMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (listMatch) {
          indent = listMatch[1];
          prefix = `${listMatch[2]}.`;
          content = listMatch[3];
        }
      } else if (isBulletList) {
        const listMatch = line.match(/^(\s*)[-•]\s+(.*)$/);
        if (listMatch) {
          indent = listMatch[1];
          prefix = '•';
          content = listMatch[2];
        }
      }

      // Process content
      const processedContent = processLineContent(content, isSentMessage, searchQuery, lineIndex);

      const listColor = isSentMessage ? "text-blue-200" : "text-blue-600";

      result.push(
        <div key={lineIndex} className={`${indent ? 'ml-4' : ''} mb-1`}>
          <span className={`font-medium ${listColor}`}>{prefix}</span> {processedContent}
        </div>
      );
    } else if (isQuote) {
      const quoteMatch = line.match(/^>\s+(.*)$/);
      const content = quoteMatch ? quoteMatch[1] : line.replace(/^>\s+/, '');

      const processedContent = processLineContent(content, isSentMessage, searchQuery, lineIndex);

      const textColor = isSentMessage ? "text-gray-200" : "text-gray-600";
      const borderColor = isSentMessage ? "border-gray-400" : "border-gray-300";

      result.push(
        <div key={lineIndex} className={`border-l-4 ${borderColor} pl-3 ml-2 italic ${textColor} mb-1`}>
          {processedContent}
        </div>
      );
    } else {
      // Regular line
      const processedContent = processLineContent(line, isSentMessage, searchQuery, lineIndex);

      // For regular lines, we return them as an array of elements if possible to avoid extra spans,
      // but to support newlines we might need a wrapper or just push elements.
      // However, FormattedTextWithLinks expects a container.

      if (processedContent && processedContent.length > 0) {
        // We wrap in a span to keep the line together, especially for line-clamp
        result.push(<span key={lineIndex}>{processedContent}</span>);
      } else if (line.trim()) {
        result.push(<span key={lineIndex}>{line}</span>);
      }

      // Add line break if not last line and line is not empty
      if (lineIndex < lines.length - 1 && line.trim()) {
        result.push(<br key={`br-${lineIndex}`} />);
      }
    }
  });

  return result;
};

// Helper to process a single line's content (markdown + links)
const processLineContent = (content, isSentMessage, searchQuery, lineIndex) => {
  const parts = [];
  let processedLine = content;

  // Process markdown formatting in order of precedence
  const patterns = [
    { regex: /\*\*(.*?)\*\*/g, tag: 'strong' }, // Bold
    { regex: /\*(.*?)\*/g, tag: 'em' }, // Italic
    { regex: /__(.*?)__/g, tag: 'u' }, // Underline
    { regex: /~~(.*?)~~/g, tag: 'del' }, // Strikethrough
  ];

  // Find all markdown patterns
  const matches = [];
  patterns.forEach(pattern => {
    let match;
    // Reset lastIndex for global regex
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(processedLine)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        tag: pattern.tag,
        full: match[0]
      });
    }
  });

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Process non-overlapping matches
  const validMatches = [];
  matches.forEach(match => {
    const overlaps = validMatches.some(vm =>
      (match.start >= vm.start && match.start < vm.end) ||
      (match.end > vm.start && match.end <= vm.end)
    );
    if (!overlaps) {
      validMatches.push(match);
    }
  });

  validMatches.sort((a, b) => a.start - b.start);
  let currentIndex = 0;

  validMatches.forEach((match, idx) => {
    // Add text before the match
    if (match.start > currentIndex) {
      const textBefore = processedLine.slice(currentIndex, match.start);
      parts.push(...(processTextSegment(textBefore, isSentMessage, searchQuery) || []));
    }

    // Add the formatted element (recursively process content inside tags)
    const TagName = match.tag;
    const contentInside = processTextSegment(match.content, isSentMessage, searchQuery);

    parts.push(
      <TagName key={`${lineIndex}-${idx}`} className={match.tag === 'u' ? 'underline' : ''}>
        {contentInside}
      </TagName>
    );

    currentIndex = match.end;
  });

  // Add remaining text
  if (currentIndex < processedLine.length) {
    const textAfter = processedLine.slice(currentIndex);
    parts.push(...(processTextSegment(textAfter, isSentMessage, searchQuery) || []));
  }

  return parts;
};

// Component wrapper for formatted text with links
export const FormattedTextWithLinks = ({ text, isSentMessage = false, className = "", style = {}, textRef = null, searchQuery = "" }) => {
  if (!text || typeof text !== 'string') return <div className={className} style={style} ref={textRef}>{text}</div>;

  // Apply formatting (Markdown + Links + Search)
  const finalFormatted = formatText(text, isSentMessage, searchQuery);

  return (
    <div className={className} style={style} ref={textRef}>
      {finalFormatted}
    </div>
  );
};

// Component wrapper for formatted text with links and search highlighting
// This is now just an alias for FormattedTextWithLinks since we consolidated logic
export const FormattedTextWithLinksAndSearch = (props) => {
  return <FormattedTextWithLinks {...props} />;
};

// Component wrapper with read more functionality for long messages
export const FormattedTextWithReadMore = ({ text, isSentMessage = false, className = "", searchQuery = "", maxLines = 4 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowReadMore, setShouldShowReadMore] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      const element = textRef.current;
      if (!isExpanded) {
        setShouldShowReadMore(element.scrollHeight > element.clientHeight);
      }
    }
  }, [text, maxLines, isExpanded]);

  return (
    <div className="relative">
      <FormattedTextWithLinks
        text={text}
        isSentMessage={isSentMessage}
        className={className}
        searchQuery={searchQuery}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: !isExpanded ? maxLines : 'unset',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
        textRef={textRef}
      />

      {shouldShowReadMore && !isExpanded && (
        <div className="mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
            className={`text-xs font-medium transition-colors duration-200 ${isSentMessage
              ? 'text-white hover:text-gray-200'
              : 'text-blue-600 hover:text-blue-800'
              }`}
          >
            Read more
          </button>
        </div>
      )}

      {isExpanded && shouldShowReadMore && (
        <div className="mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
            className={`text-xs font-medium transition-colors duration-200 ${isSentMessage
              ? 'text-white hover:text-gray-200'
              : 'text-blue-600 hover:text-blue-800'
              }`}
          >
            Read less
          </button>
        </div>
      )}
    </div>
  );
};

// Export formatLinksInText for backward compatibility if used elsewhere, 
// though it's now redundant with processTextSegment logic.
export const formatLinksInText = (text, isSentMessage = false) => {
  const segments = processTextSegment(text, isSentMessage, "");
  // Return as an array of elements or string if single
  if (!segments) return text;
  return segments;
};