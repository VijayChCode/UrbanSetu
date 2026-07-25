import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Try to convert a Cloudinary asset URL into a download link that preserves filename/type
 * by injecting the `fl_attachment:<filename>` transformation.
 */
const buildCloudinaryDownloadLink = (originalUrl, preferredFilename) => {
  if (!originalUrl || typeof originalUrl !== 'string') return originalUrl;
  try {
    // Only transform if looks like a Cloudinary upload URL
    const uploadMarker = '/upload/';
    const idx = originalUrl.indexOf(uploadMarker);
    if (idx === -1) return originalUrl;

    // If already contains fl_attachment, leave as-is
    if (/fl_attachment/.test(originalUrl)) return originalUrl;

    const before = originalUrl.slice(0, idx + uploadMarker.length);
    let after = originalUrl.slice(idx + uploadMarker.length);

    // Sanitize filename (Cloudinary expects colon syntax, keep simple ascii)
    const safeName = (preferredFilename || 'download')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 120);

    // Insert fl_attachment:<filename>/ right after /upload/
    let transformed = `${before}fl_attachment:${safeName}/${after}`;

    // If originalUrl likely points to a raw asset without extension at the end,
    // try to append the extension from preferredFilename to ensure proper type
    const extMatch = /\.([a-zA-Z0-9]+)$/.exec(preferredFilename || '');
    if (extMatch) {
      const ext = extMatch[1];
      // If URL already ends with an extension after the last '/', skip
      const lastSegment = transformed.substring(transformed.lastIndexOf('/') + 1);
      if (!/\.[a-zA-Z0-9]+$/.test(lastSegment)) {
        transformed = `${transformed}.${ext}`;
      }
    }

    return transformed;
  } catch (_) {
    return originalUrl;
  }
};

/**
 * Load image from URL and convert to base64
 */
const loadImageAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate dimensions to fit within reasonable bounds
      const maxWidth = 400;
      const maxHeight = 300;

      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      try {
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve({ base64, width, height });
      } catch (error) {
        console.warn('Failed to convert image to base64:', error);
        resolve(null);
      }
    };

    img.onerror = () => {
      console.warn('Failed to load image:', url);
      resolve(null);
    };

    img.src = url;
  });
};

/**
 * Convert emojis to text for better PDF compatibility
 */
const convertEmojiToText = (emoji) => {
  const emojiToText = {
    '👍': 'Like',
    '❤️': 'Love',
    '😂': 'Laugh',
    '😮': 'Wow',
    '😢': 'Sad',
    '😡': 'Angry',
    '🔥': 'Fire',
    '💯': '100',
    '🎉': 'Party',
    '👏': 'Clap',
    '💪': 'Strong',
    '🙏': 'Thanks'
  };
  return emojiToText[emoji] || emoji.replace(/[^\x00-\x7F]/g, '');
};

/**
 * Process message text to handle markdown formatting, links and split into lines
 */
const processMessageWithMarkdownAndLinks = (message, pdf, maxWidth) => {
  // URL regex pattern to match various link formats
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[^\s]{2,})/gi;

  // Markdown patterns
  const markdownPatterns = [
    { regex: /\*\*(.*?)\*\*/g, type: 'bold' },
    { regex: /\*(.*?)\*/g, type: 'italic' },
    { regex: /__(.*?)__/g, type: 'underline' },
    { regex: /~~(.*?)~~/g, type: 'strikethrough' },
  ];

  // First, process markdown formatting
  let processedText = message;
  const markdownElements = [];

  markdownPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(processedText)) !== null) {
      markdownElements.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type: pattern.type,
        full: match[0]
      });
    }
  });

  // Sort markdown elements by position
  markdownElements.sort((a, b) => a.start - b.start);

  // Process non-overlapping markdown elements
  const validMarkdownElements = [];
  markdownElements.forEach(element => {
    const overlaps = validMarkdownElements.some(vm =>
      (element.start >= vm.start && element.start < vm.end) ||
      (element.end > vm.start && element.end <= vm.end)
    );
    if (!overlaps) {
      validMarkdownElements.push(element);
    }
  });

  // Build the formatted text with markdown
  const textParts = [];
  let currentIndex = 0;

  validMarkdownElements.forEach((element, idx) => {
    // Add text before the element
    if (element.start > currentIndex) {
      textParts.push({
        type: 'text',
        content: processedText.slice(currentIndex, element.start)
      });
    }

    // Add the formatted element
    textParts.push({
      type: element.type,
      content: element.content
    });

    currentIndex = element.end;
  });

  // Add remaining text
  if (currentIndex < processedText.length) {
    textParts.push({
      type: 'text',
      content: processedText.slice(currentIndex)
    });
  }

  // Now process each text part for URLs
  const lines = [];
  let currentLine = '';

  textParts.forEach(part => {
    if (part.type === 'text') {
      // Process URLs in text parts
      const urlParts = part.content.split(urlRegex);

      urlParts.forEach((urlPart, index) => {
        if (urlRegex.test(urlPart)) {
          // This is a URL
          let url = urlPart;
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }

          if (currentLine.length + urlPart.length <= maxWidth) {
            currentLine += urlPart;
          } else {
            if (currentLine.trim()) {
              lines.push({ type: 'text', content: currentLine.trim() });
            }
            currentLine = urlPart;
          }

          lines.push({ type: 'url', content: urlPart, url: url });
          currentLine = '';
        } else {
          // Regular text
          if (currentLine.length + urlPart.length <= maxWidth) {
            currentLine += urlPart;
          } else {
            if (currentLine.trim()) {
              lines.push({ type: 'text', content: currentLine.trim() });
            }
            currentLine = urlPart;
          }
        }
      });
    } else {
      // Markdown formatted content
      if (currentLine.length + part.content.length <= maxWidth) {
        currentLine += part.content;
      } else {
        if (currentLine.trim()) {
          lines.push({ type: 'text', content: currentLine.trim() });
        }
        currentLine = part.content;
      }

      lines.push({
        type: part.type,
        content: part.content
      });
      currentLine = '';
    }
  });

  // Add remaining text
  if (currentLine.trim()) {
    lines.push({ type: 'text', content: currentLine.trim() });
  }

  return { lines, height: lines.length * 4 };
};

/**
 * Render message lines with markdown formatting and link support
 */
const renderMessageWithMarkdownAndLinks = (pdf, lines, startX, startY, isCurrentUser) => {
  let currentY = startY;

  lines.forEach((line, lineIndex) => {
    if (line.type === 'url') {
      // Render clickable link
      const linkColor = isCurrentUser ? [255, 255, 255] : [59, 130, 246]; // White for current user, blue for other

      pdf.setTextColor(...linkColor);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      // Add underline for links
      const textWidth = pdf.getTextWidth(line.content);
      const underlineY = currentY + 1;

      // Draw underline
      pdf.setDrawColor(...linkColor);
      pdf.line(startX, underlineY, startX + textWidth, underlineY);

      // Add clickable link
      pdf.link(startX, currentY - 3, textWidth, 4, { url: line.url });

      // Render link text
      pdf.text(line.content, startX, currentY);

      currentY += 4;
    } else if (line.type === 'bold') {
      // Render bold text
      const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
      pdf.setTextColor(...textColor);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');

      pdf.text(line.content, startX, currentY);
      currentY += 4;
    } else if (line.type === 'italic') {
      // Render italic text
      const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
      pdf.setTextColor(...textColor);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');

      pdf.text(line.content, startX, currentY);
      currentY += 4;
    } else if (line.type === 'underline') {
      // Render underlined text
      const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
      pdf.setTextColor(...textColor);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      const textWidth = pdf.getTextWidth(line.content);
      const underlineY = currentY + 1;

      // Draw underline
      pdf.setDrawColor(...textColor);
      pdf.line(startX, underlineY, startX + textWidth, underlineY);

      // Render text
      pdf.text(line.content, startX, currentY);
      currentY += 4;
    } else if (line.type === 'strikethrough') {
      // Render strikethrough text
      const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
      pdf.setTextColor(...textColor);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      const textWidth = pdf.getTextWidth(line.content);
      const strikethroughY = currentY - 1;

      // Draw strikethrough line
      pdf.setDrawColor(...textColor);
      pdf.line(startX, strikethroughY, startX + textWidth, strikethroughY);

      // Render text
      pdf.text(line.content, startX, currentY);
      currentY += 4;
    } else {
      // Render regular text
      const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
      pdf.setTextColor(...textColor);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      pdf.text(line.content, startX, currentY);
      currentY += 4;
    }
  });
};

/**
 * Export chat transcript to PDF with enhanced formatting and optional media
 * @param {Object} appointment - The appointment object
 * @param {Array} comments - Array of chat messages
 * @param {Object} currentUser - Current user object
 * @param {Object} otherParty - Other party user object
 * @param {boolean} includeMedia - Whether to include images in the PDF
 */
export const exportEnhancedChatToPDF = async (appointment, comments, currentUser, otherParty, includeMedia = false) => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Colors
    const primaryColor = [54, 102, 246]; // Blue
    const textColor = [51, 51, 51]; // Dark gray
    const lightGray = [245, 245, 245];

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredSpace = 15) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Header with gradient effect
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, 40, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('UrbanSetu Chat Transcript', pageWidth / 2, 25, { align: 'center' });

    yPosition = 50;

    // Reset text color
    pdf.setTextColor(...textColor);

    // Appointment info box
    pdf.setFillColor(...lightGray);
    pdf.roundedRect(margin, yPosition, pageWidth - (margin * 2), 45, 3, 3, 'F');

    yPosition += 8;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Appointment Information', margin + 5, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const imageCount = comments.filter(msg => msg.imageUrl && !msg.deleted).length;
    const audioCount = comments.filter(msg => msg.audioUrl && !msg.deleted).length;
    const infoLines = [
      `Property: ${appointment.propertyName || 'N/A'}`,
      `Date & Time: ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time || 'N/A'}`,
      `Participants: ${appointment.buyerId?.username || 'Unknown'} & ${appointment.sellerId?.username || 'Unknown'}`,
      `Export Type: ${includeMedia ? `With Media (${imageCount} images)` : 'Text Only'}`,
      `Audio Clips: ${audioCount}`,
      `Generated: ${new Date().toLocaleString()}`
    ];

    infoLines.forEach(line => {
      pdf.text(line, margin + 5, yPosition);
      yPosition += 5;
    });

    yPosition += 15;

    // Chat section
    checkPageBreak();
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...primaryColor);
    pdf.text('Chat Messages', margin, yPosition);
    pdf.setTextColor(...textColor);
    yPosition += 10;

    // List only chat messages chronologically
    const timelineItems = (comments || []).map(msg => ({
      type: 'message',
      id: msg._id,
      timestamp: new Date(msg.timestamp),
      message: msg,
      sortTime: new Date(msg.timestamp).getTime()
    })).sort((a, b) => a.sortTime - b.sortTime); // Sort chronologically

    if (timelineItems.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('No messages in this conversation.', margin, yPosition);
    } else {
      // Filter valid messages
      const validItems = timelineItems.filter(item => {
        const msg = item.message;
        return msg && !msg.deleted && (msg.message?.trim() || msg.imageUrl || msg.audioUrl || msg.videoUrl || msg.documentUrl);
      });

      let currentDate = '';

      // Pre-load all images if including media
      const imageCache = {};
      if (includeMedia) {
        const imageMessages = validItems
          .filter(item => item.type === 'message' && item.message?.imageUrl)
          .map(item => item.message);
        for (const message of imageMessages) {
          try {
            const imageData = await loadImageAsBase64(message.imageUrl);
            if (imageData) {
              imageCache[message.imageUrl] = imageData;
            }
          } catch (error) {
            console.warn('Failed to load image for PDF:', message.imageUrl, error);
          }
        }
      }


      for (const item of validItems) {
        const itemDate = item.timestamp.toDateString();
        const message = item.message;
        const messageDate = new Date(message.timestamp).toDateString();

        // Add date separator if new day
        if (messageDate !== currentDate) {
          checkPageBreak(15);
          currentDate = messageDate;

          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPosition - 2, pageWidth - (margin * 2), 8, 'F');
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(new Date(message.timestamp).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }), pageWidth / 2, yPosition + 3, { align: 'center' });
          yPosition += 12;
        }

        const isCurrentUser = message.senderEmail === currentUser.email;
        const senderName = isCurrentUser ? 'You' :
          (otherParty?.username || 'Other Party');

        // Handle image messages
        if (message.imageUrl) {
          const requiredSpace = includeMedia ? 80 : 25;
          checkPageBreak(requiredSpace);

          // Sender name and timestamp for image
          pdf.setTextColor(128, 128, 128);
          pdf.setFontSize(7);
          const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });

          // Add edited indicator to timestamp if message was edited
          const editedText = message.edited ? ' (Edited)' : '';
          const timestampText = `${senderName} ${timestamp}${editedText}`;

          if (isCurrentUser) {
            pdf.text(timestampText, pageWidth - margin - 60, yPosition - 2);
          } else {
            pdf.text(timestampText, margin + 25, yPosition - 2);
          }

          if (includeMedia && imageCache[message.imageUrl]) {
            // Include actual image
            const imageData = imageCache[message.imageUrl];
            const imgWidth = Math.min(60, imageData.width * 0.2);
            const imgHeight = (imageData.height * imgWidth) / imageData.width;

            try {
              if (isCurrentUser) {
                pdf.addImage(imageData.base64, 'JPEG', pageWidth - margin - imgWidth - 5, yPosition, imgWidth, imgHeight);
              } else {
                pdf.addImage(imageData.base64, 'JPEG', margin + 25, yPosition, imgWidth, imgHeight);
              }
              yPosition += imgHeight + 5;

              // Add clickable image URL below the embedded image when includeMedia is true
              checkPageBreak();

              // Add "Image Source:" label
              pdf.setTextColor(128, 128, 128);
              pdf.setFontSize(7);
              const labelText = 'Image Source:';
              const labelX = isCurrentUser ? pageWidth - margin - imgWidth - 5 : margin + 25;
              pdf.text(labelText, labelX, yPosition);
              yPosition += 4;

              // Add clickable image URL
              const linkColor = [59, 130, 246]; // Blue color for links
              pdf.setTextColor(...linkColor);
              pdf.setFontSize(7);
              pdf.setFont('helvetica', 'normal');

              // Shorten URL for display if too long
              let displayUrl = message.imageUrl;
              const maxUrlLength = 45;
              if (displayUrl.length > maxUrlLength) {
                displayUrl = displayUrl.substring(0, maxUrlLength - 3) + '...';
              }

              const urlX = isCurrentUser ? pageWidth - margin - imgWidth - 5 : margin + 25;
              const textWidth = pdf.getTextWidth(displayUrl);
              const underlineY = yPosition + 1;

              // Draw underline for the link
              pdf.setDrawColor(...linkColor);
              pdf.line(urlX, underlineY, urlX + textWidth, underlineY);

              // Add clickable link
              pdf.link(urlX, yPosition - 3, textWidth, 4, { url: message.imageUrl });

              // Render link text
              pdf.text(displayUrl, urlX, yPosition);
              yPosition += 6;

            } catch (error) {
              console.warn('Failed to add image to PDF:', error);
              // Fall back to placeholder
              pdf.setFillColor(240, 240, 240);
              const placeholderWidth = 60;
              const placeholderHeight = 40;
              if (isCurrentUser) {
                pdf.rect(pageWidth - margin - placeholderWidth - 5, yPosition, placeholderWidth, placeholderHeight, 'F');
              } else {
                pdf.rect(margin + 25, yPosition, placeholderWidth, placeholderHeight, 'F');
              }
              pdf.setTextColor(...textColor);
              pdf.setFontSize(8);
              pdf.text('[Image]', isCurrentUser ? pageWidth - margin - 35 : margin + 55, yPosition + 22, { align: 'center' });
              yPosition += placeholderHeight + 5;
            }
          } else {
            // Image placeholder (when includeMedia is false)
            pdf.setFillColor(240, 240, 240);
            const placeholderWidth = 60;
            const placeholderHeight = 40;

            if (isCurrentUser) {
              pdf.rect(pageWidth - margin - placeholderWidth - 5, yPosition, placeholderWidth, placeholderHeight, 'F');
              pdf.setDrawColor(200, 200, 200);
              pdf.rect(pageWidth - margin - placeholderWidth - 5, yPosition, placeholderWidth, placeholderHeight);
            } else {
              pdf.rect(margin + 25, yPosition, placeholderWidth, placeholderHeight, 'F');
              pdf.setDrawColor(200, 200, 200);
              pdf.rect(margin + 25, yPosition, placeholderWidth, placeholderHeight);
            }

            pdf.setTextColor(...textColor);
            pdf.setFontSize(8);
            pdf.text('Image', isCurrentUser ? pageWidth - margin - 35 : margin + 55, yPosition + 22, { align: 'center' });
            yPosition += placeholderHeight + 5;

            // Add clickable image URL below the placeholder (for text-only export)
            if (message.imageUrl) {
              checkPageBreak();

              // Add "View Image:" label
              pdf.setTextColor(128, 128, 128);
              pdf.setFontSize(7);
              const labelText = 'View Image:';
              const labelX = isCurrentUser ? pageWidth - margin - placeholderWidth - 5 : margin + 25;
              pdf.text(labelText, labelX, yPosition);
              yPosition += 4;

              // Add clickable image URL
              const linkColor = [59, 130, 246]; // Blue color for links
              pdf.setTextColor(...linkColor);
              pdf.setFontSize(7);
              pdf.setFont('helvetica', 'normal');

              // Shorten URL for display if too long
              let displayUrl = message.imageUrl;
              const maxUrlLength = 45;
              if (displayUrl.length > maxUrlLength) {
                displayUrl = displayUrl.substring(0, maxUrlLength - 3) + '...';
              }

              const urlX = isCurrentUser ? pageWidth - margin - placeholderWidth - 5 : margin + 25;
              const textWidth = pdf.getTextWidth(displayUrl);
              const underlineY = yPosition + 1;

              // Draw underline for the link
              pdf.setDrawColor(...linkColor);
              pdf.line(urlX, underlineY, urlX + textWidth, underlineY);

              // Add clickable link
              pdf.link(urlX, yPosition - 3, textWidth, 4, { url: message.imageUrl });

              // Render link text
              pdf.text(displayUrl, urlX, yPosition);
              yPosition += 6;
            }
          }

          // Add image caption if exists
          if (message.message && message.message.trim()) {
            // Process caption with markdown and link support
            const processedCaption = processMessageWithMarkdownAndLinks(message.message.trim(), pdf, 60);

            processedCaption.lines.forEach(line => {
              checkPageBreak();
              const startX = isCurrentUser ? pageWidth - margin - 65 : margin + 25;

              if (line.type === 'url') {
                // Render clickable link in caption
                const linkColor = isCurrentUser ? [255, 255, 255] : [59, 130, 246];
                pdf.setTextColor(...linkColor);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');

                // Add underline for links
                const textWidth = pdf.getTextWidth(line.content);
                const underlineY = yPosition + 1;

                // Draw underline
                pdf.setDrawColor(...linkColor);
                pdf.line(startX, underlineY, startX + textWidth, underlineY);

                // Add clickable link
                pdf.link(startX, yPosition - 3, textWidth, 4, { url: line.url });
                pdf.text(line.content, startX, yPosition);
              } else if (line.type === 'bold') {
                // Render bold text in caption
                const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
                pdf.setTextColor(...textColor);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.text(line.content, startX, yPosition);
              } else if (line.type === 'italic') {
                // Render italic text in caption
                const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
                pdf.setTextColor(...textColor);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'italic');
                pdf.text(line.content, startX, yPosition);
              } else if (line.type === 'underline') {
                // Render underlined text in caption
                const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
                pdf.setTextColor(...textColor);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');

                const textWidth = pdf.getTextWidth(line.content);
                const underlineY = yPosition + 1;

                // Draw underline
                pdf.setDrawColor(...textColor);
                pdf.line(startX, underlineY, startX + textWidth, underlineY);
                pdf.text(line.content, startX, yPosition);
              } else if (line.type === 'strikethrough') {
                // Render strikethrough text in caption
                const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
                pdf.setTextColor(...textColor);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');

                const textWidth = pdf.getTextWidth(line.content);
                const strikethroughY = yPosition - 1;

                // Draw strikethrough line
                pdf.setDrawColor(...textColor);
                pdf.line(startX, strikethroughY, startX + textWidth, strikethroughY);
                pdf.text(line.content, startX, yPosition);
              } else {
                // Regular text in caption
                const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
                pdf.setTextColor(...textColor);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(line.content, startX, yPosition);
              }
              yPosition += 4;
            });
          }

          // Add reply context if this message is a reply
          if (message.replyTo) {
            checkPageBreak(12);
            const replyToMessage = comments.find(msg => msg._id === message.replyTo);
            if (replyToMessage) {
              pdf.setTextColor(128, 128, 128);
              pdf.setFontSize(7);
              pdf.setFont('helvetica', 'italic');

              const replyText = `Reply to: "${(replyToMessage.message || 'Media message').substring(0, 50)}${(replyToMessage.message || '').length > 50 ? '...' : ''}"`;
              const replyX = isCurrentUser ? pageWidth - margin - 60 : margin + 25;

              pdf.text(replyText, replyX, yPosition);
              yPosition += 6;
            }
          }

          // Add reactions if present
          if (message.reactions && message.reactions.length > 0) {
            checkPageBreak(8);

            // Group reactions by emoji
            const groupedReactions = {};
            message.reactions.forEach(reaction => {
              if (!groupedReactions[reaction.emoji]) {
                groupedReactions[reaction.emoji] = [];
              }
              groupedReactions[reaction.emoji].push(reaction);
            });

            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');

            const reactionsText = Object.entries(groupedReactions)
              .map(([emoji, reactions]) => {
                const displayText = convertEmojiToText(emoji);
                return `${displayText}(${reactions.length})`;
              })
              .join('  ');

            const reactionsX = isCurrentUser ? pageWidth - margin - 60 : margin + 25;
            pdf.text(`Reactions: ${reactionsText}`, reactionsX, yPosition);
            yPosition += 6;
          }

          yPosition += 8;
        }
        // Handle video/doc/audio placeholders with links
        else if (message.videoUrl || message.documentUrl || message.audioUrl) {
          checkPageBreak(28);
          const isVideo = !!message.videoUrl;
          const isDocument = !!message.documentUrl && !isVideo;
          const isAudio = !!message.audioUrl && !isVideo && !isDocument;
          const label = isVideo ? 'Video' : isDocument ? 'Document' : 'Audio';
          const rawLink = isVideo ? message.videoUrl : isDocument ? message.documentUrl : message.audioUrl;
          const name = isAudio ? (message.audioName || 'Audio') :
            isVideo ? (message.videoName || 'Video') :
              isDocument ? (message.documentName || 'Document') : 'Media';
          // For videos/audio: keep original URL to allow preview on Cloudinary
          // For documents: transform to force download with correct filename/type
          const link = (isVideo || isAudio) ? rawLink : buildCloudinaryDownloadLink(rawLink, name);

          const bubbleWidth = Math.min(120, pageWidth - (margin * 2) - 20);

          // Draw placeholder bubble
          if (isCurrentUser) {
            pdf.setFillColor(...primaryColor);
            pdf.roundedRect(pageWidth - margin - bubbleWidth, yPosition, bubbleWidth, 20, 2, 2, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.text(`${label}: ${name}`, pageWidth - margin - bubbleWidth + 5, yPosition + 12);
          } else {
            pdf.setFillColor(250, 250, 250);
            pdf.roundedRect(margin + 20, yPosition, bubbleWidth, 20, 2, 2, 'F');
            pdf.setTextColor(51, 51, 51);
            pdf.setFontSize(9);
            pdf.text(`${label}: ${name}`, margin + 25, yPosition + 12);
          }

          yPosition += 24;

          // Add clickable Cloudinary link below
          if (link) {
            checkPageBreak();
            const linkColor = [59, 130, 246];
            pdf.setTextColor(...linkColor);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');

            let displayUrl = link;
            const maxUrlLength = 60;
            if (displayUrl.length > maxUrlLength) {
              displayUrl = displayUrl.substring(0, maxUrlLength - 3) + '...';
            }

            const urlX = isCurrentUser ? pageWidth - margin - bubbleWidth + 5 : margin + 25;
            const textWidth = pdf.getTextWidth(displayUrl);
            const underlineY = yPosition + 1;

            pdf.setDrawColor(...linkColor);
            pdf.line(urlX, underlineY, urlX + textWidth, underlineY);
            pdf.link(urlX, yPosition - 3, textWidth, 4, { url: link });
            pdf.text(displayUrl, urlX, yPosition);
            yPosition += 6;
          }

          // Add caption if present
          if (message.message && message.message.trim()) {
            const processedCaption = processMessageWithMarkdownAndLinks(message.message.trim(), pdf, bubbleWidth - 10);
            processedCaption.lines.forEach(line => {
              checkPageBreak();
              const startX = isCurrentUser ? pageWidth - margin - bubbleWidth + 5 : margin + 25;
              if (line.type === 'url') {
                const linkColor2 = isCurrentUser ? [255, 255, 255] : [59, 130, 246];
                pdf.setTextColor(...linkColor2);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                const textWidth2 = pdf.getTextWidth(line.content);
                const underlineY2 = yPosition + 1;
                pdf.setDrawColor(...linkColor2);
                pdf.line(startX, underlineY2, startX + textWidth2, underlineY2);
                pdf.link(startX, yPosition - 3, textWidth2, 4, { url: line.url });
                pdf.text(line.content, startX, yPosition);
              } else {
                const textColor2 = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
                pdf.setTextColor(...textColor2);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(line.content, startX, yPosition);
              }
              yPosition += 4;
            });
          }

          // Add reply context if this message is a reply
          if (message.replyTo) {
            checkPageBreak(12);
            const replyToMessage = comments.find(msg => msg._id === message.replyTo);
            if (replyToMessage) {
              pdf.setTextColor(128, 128, 128);
              pdf.setFontSize(7);
              pdf.setFont('helvetica', 'italic');

              const replyText = `Reply to: "${(replyToMessage.message || 'Media message').substring(0, 50)}${(replyToMessage.message || '').length > 50 ? '...' : ''}"`;
              const replyX = isCurrentUser ? pageWidth - margin - bubbleWidth + 5 : margin + 25;

              pdf.text(replyText, replyX, yPosition);
              yPosition += 6;
            }
          }

          // Add reactions if present
          if (message.reactions && message.reactions.length > 0) {
            checkPageBreak(8);

            // Group reactions by emoji
            const groupedReactions = {};
            message.reactions.forEach(reaction => {
              if (!groupedReactions[reaction.emoji]) {
                groupedReactions[reaction.emoji] = [];
              }
              groupedReactions[reaction.emoji].push(reaction);
            });

            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');

            const reactionsText = Object.entries(groupedReactions)
              .map(([emoji, reactions]) => {
                const displayText = convertEmojiToText(emoji);
                return `${displayText}(${reactions.length})`;
              })
              .join('  ');

            const reactionsX = isCurrentUser ? pageWidth - margin - bubbleWidth + 5 : margin + 25;
            pdf.text(`Reactions: ${reactionsText}`, reactionsX, yPosition);
            yPosition += 6;
          }

          yPosition += 4;
        }
        else if (message.message && message.message.trim()) {
          // Regular text message with markdown and link handling
          checkPageBreak(20);

          // Message bubble effect
          const bubbleWidth = Math.min(120, pageWidth - (margin * 2) - 20);

          // Process message to handle markdown and links
          const processedMessage = processMessageWithMarkdownAndLinks(message.message.trim(), pdf, bubbleWidth - 10);
          const messageLines = processedMessage.lines;
          const bubbleHeight = (messageLines.length * 4) + 8;

          if (isCurrentUser) {
            // Right-aligned bubble (current user)
            pdf.setFillColor(...primaryColor);
            pdf.roundedRect(pageWidth - margin - bubbleWidth, yPosition, bubbleWidth, bubbleHeight, 2, 2, 'F');

            // Render message lines with markdown and link support
            renderMessageWithMarkdownAndLinks(pdf, messageLines, pageWidth - margin - bubbleWidth + 5, yPosition + 8, true);
          } else {
            // Left-aligned bubble (other party)
            pdf.setFillColor(250, 250, 250);
            pdf.roundedRect(margin + 20, yPosition, bubbleWidth, bubbleHeight, 2, 2, 'F');

            // Render message lines with markdown and link support
            renderMessageWithMarkdownAndLinks(pdf, messageLines, margin + 25, yPosition + 8, false);
          }

          // Sender name and timestamp
          pdf.setTextColor(128, 128, 128);
          pdf.setFontSize(7);
          const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });

          // Add edited indicator to timestamp if message was edited
          const editedText = message.edited ? ' (Edited)' : '';
          const timestampText = `${senderName} ${timestamp}${editedText}`;

          if (isCurrentUser) {
            pdf.text(timestampText, pageWidth - margin - bubbleWidth + 5, yPosition - 2);
          } else {
            pdf.text(timestampText, margin + 25, yPosition - 2);
          }

          yPosition += bubbleHeight + 8;

          // Add reply context if this message is a reply
          if (message.replyTo) {
            checkPageBreak(12);
            const replyToMessage = comments.find(msg => msg._id === message.replyTo);
            if (replyToMessage) {
              pdf.setTextColor(128, 128, 128);
              pdf.setFontSize(7);
              pdf.setFont('helvetica', 'italic');

              const replyText = `Reply to: "${(replyToMessage.message || 'Media message').substring(0, 50)}${(replyToMessage.message || '').length > 50 ? '...' : ''}"`;
              const replyX = isCurrentUser ? pageWidth - margin - bubbleWidth + 5 : margin + 25;

              pdf.text(replyText, replyX, yPosition);
              yPosition += 6;
            }
          }

          // Add reactions if present
          if (message.reactions && message.reactions.length > 0) {
            checkPageBreak(8);

            // Group reactions by emoji
            const groupedReactions = {};
            message.reactions.forEach(reaction => {
              if (!groupedReactions[reaction.emoji]) {
                groupedReactions[reaction.emoji] = [];
              }
              groupedReactions[reaction.emoji].push(reaction);
            });

            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');

            const reactionsText = Object.entries(groupedReactions)
              .map(([emoji, reactions]) => {
                const displayText = convertEmojiToText(emoji);
                return `${displayText}(${reactions.length})`;
              })
              .join('  ');

            const reactionsX = isCurrentUser ? pageWidth - margin - bubbleWidth + 5 : margin + 25;
            pdf.text(`Reactions: ${reactionsText}`, reactionsX, yPosition);
            yPosition += 6;
          }

          yPosition += 2;
          pdf.setTextColor(...textColor);
        }
      }
    }

    // Footer on all pages
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // Footer background
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');

      // Page number
      pdf.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });

      // Export info
      const exportInfo = `${includeMedia ? 'With Media' : 'Text Only'} - Exported by ${currentUser.username}`;
      pdf.text(exportInfo, margin, pageHeight - 5);
    }

    // Generate filename
    const propertyName = appointment.propertyName ?
      appointment.propertyName.replace(/[^a-zA-Z0-9]/g, '_') :
      'Chat';
    const dateStr = new Date().toISOString().split('T')[0];
    const mediaType = includeMedia ? 'WithMedia' : 'TextOnly';
    const filename = `UrbanSetu_${propertyName}_${mediaType}_${dateStr}.pdf`;

    // Save the PDF
    pdf.save(filename);

    return { success: true, filename };
  } catch (error) {
    console.error('Error generating enhanced PDF:', error);
    return { success: false, error: error.message };
  }
};