import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
 * Process message text to handle links and split into lines
 */
const processMessageWithLinks = (message, pdf, maxWidth) => {
  // URL regex pattern to match various link formats
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[^\s]{2,})/gi;
  
  // Split message into parts (text and URLs)
  const parts = message.split(urlRegex);
  const lines = [];
  let currentLine = '';
  
  parts.forEach((part, index) => {
    // Check if this part is a URL
    if (urlRegex.test(part)) {
      // Ensure URL has protocol
      let url = part;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Add URL to current line or create new line if needed
      const urlWithProtocol = url;
      const displayUrl = part;
      
      if (currentLine.length + displayUrl.length <= maxWidth) {
        currentLine += displayUrl;
      } else {
        if (currentLine.trim()) {
          lines.push({ type: 'text', content: currentLine.trim() });
        }
        currentLine = displayUrl;
      }
      
      // Add URL object to lines
      lines.push({ type: 'url', content: displayUrl, url: urlWithProtocol });
      currentLine = '';
    } else {
      // Regular text
      if (currentLine.length + part.length <= maxWidth) {
        currentLine += part;
      } else {
        if (currentLine.trim()) {
          lines.push({ type: 'text', content: currentLine.trim() });
        }
        currentLine = part;
      }
    }
  });
  
  // Add remaining text
  if (currentLine.trim()) {
    lines.push({ type: 'text', content: currentLine.trim() });
  }
  
  return { lines, height: lines.length * 4 };
};

/**
 * Render message lines with link support
 */
const renderMessageWithLinks = (pdf, lines, startX, startY, isCurrentUser) => {
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
    const infoLines = [
      `Property: ${appointment.propertyName || 'N/A'}`,
      `Date & Time: ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time || 'N/A'}`,
      `Participants: ${appointment.buyerId?.username || 'Unknown'} & ${appointment.sellerId?.username || 'Unknown'}`,
      `Export Type: ${includeMedia ? `With Media (${imageCount} images)` : 'Text Only'}`,
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

    if (!comments || comments.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('No messages in this conversation.', margin, yPosition);
    } else {
      const validMessages = comments
        .filter(msg => !msg.deleted && (msg.message?.trim() || msg.imageUrl))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      let currentDate = '';

      // Pre-load all images if including media
      const imageCache = {};
      if (includeMedia) {
        const imageMessages = validMessages.filter(msg => msg.imageUrl);
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

      for (const message of validMessages) {
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
          
          if (isCurrentUser) {
            pdf.text(`${senderName} ${timestamp}`, pageWidth - margin - 60, yPosition - 2);
          } else {
            pdf.text(`${senderName} ${timestamp}`, margin + 25, yPosition - 2);
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
            // Image placeholder
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
            pdf.text('📷 Image', isCurrentUser ? pageWidth - margin - 35 : margin + 55, yPosition + 22, { align: 'center' });
            yPosition += placeholderHeight + 5;
          }

          // Add image caption if exists
          if (message.message && message.message.trim()) {
            // Process caption with link support
            const processedCaption = processMessageWithLinks(message.message.trim(), pdf, 60);
            
            processedCaption.lines.forEach(line => {
              checkPageBreak();
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
                if (isCurrentUser) {
                  pdf.line(pageWidth - margin - 65, underlineY, pageWidth - margin - 65 + textWidth, underlineY);
                  // Add clickable link
                  pdf.link(pageWidth - margin - 65, yPosition - 3, textWidth, 4, { url: line.url });
                  pdf.text(line.content, pageWidth - margin - 65, yPosition);
                } else {
                  pdf.line(margin + 25, underlineY, margin + 25 + textWidth, underlineY);
                  // Add clickable link
                  pdf.link(margin + 25, yPosition - 3, textWidth, 4, { url: line.url });
                  pdf.text(line.content, margin + 25, yPosition);
                }
              } else {
                // Regular text in caption
                const textColor = isCurrentUser ? [255, 255, 255] : [51, 51, 51];
                pdf.setTextColor(...textColor);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                
                if (isCurrentUser) {
                  pdf.text(line.content, pageWidth - margin - 65, yPosition);
                } else {
                  pdf.text(line.content, margin + 25, yPosition);
                }
              }
              yPosition += 4;
            });
          }

          yPosition += 8;
        } else if (message.message && message.message.trim()) {
          // Regular text message with link handling
          checkPageBreak(20);

          // Message bubble effect
          const bubbleWidth = Math.min(120, pageWidth - (margin * 2) - 20);
          
          // Process message to handle links
          const processedMessage = processMessageWithLinks(message.message.trim(), pdf, bubbleWidth - 10);
          const messageLines = processedMessage.lines;
          const bubbleHeight = (messageLines.length * 4) + 8;

          if (isCurrentUser) {
            // Right-aligned bubble (current user)
            pdf.setFillColor(...primaryColor);
            pdf.roundedRect(pageWidth - margin - bubbleWidth, yPosition, bubbleWidth, bubbleHeight, 2, 2, 'F');
            
            // Render message lines with link support
            renderMessageWithLinks(pdf, messageLines, pageWidth - margin - bubbleWidth + 5, yPosition + 8, true);
          } else {
            // Left-aligned bubble (other party)
            pdf.setFillColor(250, 250, 250);
            pdf.roundedRect(margin + 20, yPosition, bubbleWidth, bubbleHeight, 2, 2, 'F');
            
            // Render message lines with link support
            renderMessageWithLinks(pdf, messageLines, margin + 25, yPosition + 8, false);
          }

          // Sender name and timestamp
          pdf.setTextColor(128, 128, 128);
          pdf.setFontSize(7);
          const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          if (isCurrentUser) {
            pdf.text(`${senderName} ${timestamp}`, pageWidth - margin - bubbleWidth + 5, yPosition - 2);
          } else {
            pdf.text(`${senderName} ${timestamp}`, margin + 25, yPosition - 2);
          }

          yPosition += bubbleHeight + 8;
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