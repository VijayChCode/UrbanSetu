import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ContactSupport from '../components/ContactSupport';
import PublicHome from './PublicHome';

import { usePageTitle } from '../hooks/usePageTitle';
import SEO from '../components/SEO';

export default function Contact() {
  // Set page title
  usePageTitle("Contact Us - Get in Touch");

  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previousUrl, setPreviousUrl] = useState(null);

  useEffect(() => {
    // Get the previous URL from state or default to home
    const from = location.state?.from || '/';
    setPreviousUrl(from);
    
    // Open modal immediately when page loads
    setIsModalOpen(true);
  }, [location.state]);

  const handleModalClose = () => {
    setIsModalOpen(false);
    // Navigate back to previous URL after a short delay to allow modal close animation
    setTimeout(() => {
      navigate(previousUrl, { replace: true });
    }, 300);
  };

  return (
    <div>
      <SEO
        title="Contact Us - Support & Inquiries | UrbanSetu"
        description="Get in touch with the UrbanSetu support team for property inquiries, customer assistance, partnerships, and verified real estate queries across India."
        keywords="contact urbansetu, real estate support, property helpdesk, customer care India, property inquiry"
      />
      {/* Render the previous page content behind the modal */}
      <PublicHome />
      
      {/* Render ContactSupport with custom modal control */}
      <ContactSupport 
        forceModalOpen={isModalOpen}
        onModalClose={handleModalClose}
      />
    </div>
  );
}
