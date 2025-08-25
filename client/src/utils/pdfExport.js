import jsPDF from 'jspdf';

/**
 * Export chat transcript to PDF with enhanced formatting
 * @param {Object} appointment - The appointment object
 * @param {Array} comments - Array of chat messages
 * @param {Object} currentUser - Current user object
 * @param {Object} otherParty - Other party user object
 */
export const exportEnhancedChatToPDF = async (appointment, comments, currentUser, otherParty) => {
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
    pdf.roundedRect(margin, yPosition, pageWidth - (margin * 2), 35, 3, 3, 'F');
    
    yPosition += 8;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Appointment Information', margin + 5, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    const infoLines = [
      `Property: ${appointment.propertyName || 'N/A'}`,
      `Date & Time: ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time || 'N/A'}`,
      `Participants: ${appointment.buyerId?.username || 'Unknown'} & ${appointment.sellerId?.username || 'Unknown'}`
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
        .filter(msg => !msg.deleted && msg.message && msg.message.trim())
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      let currentDate = '';

      validMessages.forEach((message, index) => {
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

        checkPageBreak(20);

        const isCurrentUser = message.senderEmail === currentUser.email;
        const senderName = isCurrentUser ? 'You' : 
          (otherParty?.username || 'Other Party');

        // Message bubble effect
        const bubbleWidth = Math.min(120, pageWidth - (margin * 2) - 20);
        const messageLines = pdf.splitTextToSize(message.message.trim(), bubbleWidth - 10);
        const bubbleHeight = (messageLines.length * 4) + 8;

        if (isCurrentUser) {
          // Right-aligned bubble (current user)
          pdf.setFillColor(...primaryColor);
          pdf.roundedRect(pageWidth - margin - bubbleWidth, yPosition, bubbleWidth, bubbleHeight, 2, 2, 'F');
          
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          
          messageLines.forEach((line, lineIndex) => {
            pdf.text(line, pageWidth - margin - bubbleWidth + 5, yPosition + 8 + (lineIndex * 4));
          });
        } else {
          // Left-aligned bubble (other party)
          pdf.setFillColor(250, 250, 250);
          pdf.roundedRect(margin + 20, yPosition, bubbleWidth, bubbleHeight, 2, 2, 'F');
          
          pdf.setTextColor(...textColor);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          
          messageLines.forEach((line, lineIndex) => {
            pdf.text(line, margin + 25, yPosition + 8 + (lineIndex * 4));
          });
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
      });
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
      pdf.text(`Exported by ${currentUser.username} on ${new Date().toLocaleDateString()}`, margin, pageHeight - 5);
    }

    // Generate filename
    const propertyName = appointment.propertyName ? 
      appointment.propertyName.replace(/[^a-zA-Z0-9]/g, '_') : 
      'Chat';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `UrbanSetu_${propertyName}_${dateStr}.pdf`;

    // Save the PDF
    pdf.save(filename);

    return { success: true, filename };
  } catch (error) {
    console.error('Error generating enhanced PDF:', error);
    return { success: false, error: error.message };
  }
};