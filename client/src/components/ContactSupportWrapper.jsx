import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import ContactSupport from './ContactSupport';
import AdminContactSupport from './AdminContactSupport';

export default function ContactSupportWrapper() {
  const { currentUser } = useSelector((state) => state.user);
  const [isGeminiOpen, setIsGeminiOpen] = useState(false);

  // Listen for Gemini chatbox toggle events
  useEffect(() => {
    const handleGeminiToggle = (event) => {
      setIsGeminiOpen(event.detail.isOpen);
    };

    window.addEventListener('geminiChatboxToggle', handleGeminiToggle);
    
    return () => {
      window.removeEventListener('geminiChatboxToggle', handleGeminiToggle);
    };
  }, []);

  // Check if user is an approved admin or the default admin
  const isAdmin = currentUser && 
                  (currentUser.role === 'admin' || currentUser.role === 'rootadmin') && 
                  (currentUser.adminApprovalStatus === 'approved' || currentUser.isDefaultAdmin);

  // Hide contact support when Gemini is open on mobile/small screens
  if (isGeminiOpen) {
    return null;
  }

  // Show admin contact support for approved admins or default admin, regular contact support for others
  return isAdmin ? <AdminContactSupport /> : <ContactSupport />;
} 