import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GeminiChatbox from '../components/GeminiChatbox';
import PublicHome from './PublicHome';

import { usePageTitle } from '../hooks/usePageTitle';
import SEO from '../components/SEO';

export default function PublicAI() {
  // Set page title
  usePageTitle("SetuAI - Smart AI Real Estate Assistant");

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
        title="SetuAI - Smart AI Real Estate Assistant | UrbanSetu"
        description="Interact with SetuAI, UrbanSetu's intelligent real estate assistant. Get instant AI property recommendations, rental price insights, smart neighborhood comparisons, and market trend forecasts."
        keywords="SetuAI, real estate AI, AI property search, AI real estate assistant India, smart property recommendation, Gemini real estate"
      />
      {/* Render the previous page content behind the modal */}
      <PublicHome />
      
      {/* Render GeminiChatbox with custom modal control */}
      <GeminiChatbox 
        forceModalOpen={isModalOpen}
        onModalClose={handleModalClose}
      />
    </div>
  );
}
