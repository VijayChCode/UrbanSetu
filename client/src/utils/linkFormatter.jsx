// Utility function to detect and format links in text
export const formatLinksInText = (text, isSentMessage = false) => {
  if (!text || typeof text !== 'string') return text;

  // URL regex pattern to match various link formats
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[^\s]{2,})/gi;
  
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    // Check if this part is a URL
    if (urlRegex.test(part)) {
      // Ensure URL has protocol
      let url = part;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Different styling for sent vs received messages
      const linkClasses = isSentMessage 
        ? "text-white hover:text-blue-200 hover:underline transition-colors duration-200" // White for sent messages (blue background)
        : "text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"; // Blue for received messages (white/gray background)
      
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    return part;
  });
};