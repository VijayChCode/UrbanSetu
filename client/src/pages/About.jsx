import React, { useState, useEffect } from 'react'

import { FaBullseye, FaGlobe, FaUsers, FaShieldAlt, FaUserFriends, FaEnvelope, FaStar } from 'react-icons/fa';
import { useSelector } from 'react-redux';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function About() {
  const [aboutData, setAboutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useSelector((state) => state.user) || {};
  let termsLink = '/terms';
  let privacyLink = '/privacy';
  if (currentUser) {
    if (currentUser.role === 'admin' || currentUser.role === 'rootadmin') {
      termsLink = '/admin/terms';
      privacyLink = '/admin/privacy';
    } else {
      termsLink = '/user/terms';
      privacyLink = '/user/privacy';
    }
  }

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/about`);
        if (response.ok) {
          const data = await response.json();
          setAboutData(data);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching about data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAboutData();
  }, []);

  if (loading || !aboutData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading about page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
        {/* 1. Introduction / Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-blue-700 mb-4 drop-shadow flex items-center justify-center gap-2">
            <FaGlobe className="inline-block text-blue-400 mr-2" /> {aboutData.heroTitle || 'Welcome to UrbanSetu'}
          </h1>
          <p className="text-lg text-slate-700 font-medium">
            {aboutData.heroText || ''}
          </p>
        </div>

        {/* 2. Our Mission */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2 mb-2">
            <FaBullseye className="text-purple-500" /> Our Mission
          </h2>
          <p className="text-slate-700 text-lg">
            {aboutData.mission || ''}
          </p>
        </div>

        {/* 3. What We Offer / Key Features */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2 mb-2">
            <FaStar className="text-yellow-500" /> What We Offer
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-700 text-lg">
            {(aboutData.features || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* 4. Who We Serve */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2 mb-2">
            <FaUsers className="text-green-500" /> Who We Serve
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-700 text-lg">
            {(aboutData.whoWeServe || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* 5. Trust & Transparency */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2 mb-2">
            <FaShieldAlt className="text-blue-500" /> Trust & Transparency
          </h2>
          <p className="text-slate-700 text-lg">
            {aboutData.trust || ''}
          </p>
        </div>

        {/* 6. Our Team (Optional) */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2 mb-2">
            <FaUserFriends className="text-purple-500" /> Our Team
          </h2>
          <p className="text-slate-700 text-lg">
            {aboutData.team || ''}
          </p>
        </div>

        {/* 7. Contact / Support Info */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2 mb-2">
            <FaEnvelope className="text-green-500" /> Contact & Support
          </h2>
          <p className="text-slate-700 text-lg whitespace-pre-line">
            {aboutData.contact || ''}
          </p>
        </div>
      </div>
      {/* Connect with Us section */}
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 mt-6 flex flex-col items-center">
        <h2 className="text-xl font-bold mb-2">Connect with Us</h2>
        <div className="flex gap-4 text-2xl mb-2">
          <a href="mailto:contact@urbansetu.com" target="_blank" rel="noopener noreferrer" title="Email"><FaEnvelope /></a>
          <a href="https://instagram.com/urbansetu" target="_blank" rel="noopener noreferrer" title="Instagram"><svg className="inline w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5zm4.25 2.25a5.25 5.25 0 1 1 0 10.5a5.25 5.25 0 0 1 0-10.5zm0 1.5a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 0 0 0-7.5zm5.25 1.25a1 1 0 1 1 0 2a1 1 0 0 1 0-2z"/></svg></a>
          <a href="https://x.com/urbansetu" target="_blank" rel="noopener noreferrer" title="X"><svg className="inline w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.53 2H21l-7.19 8.21L22 22h-6.56l-5.18-6.98L2.47 22H-1l7.61-8.7L2 2h6.56l4.93 6.64L17.53 2zm-2.1 16.5h2.13l-5.98-8.06l-2.13-2.87H7.47l5.98 8.06l2.13 2.87z"/></svg></a>
          <a href="https://facebook.com/urbansetu" target="_blank" rel="noopener noreferrer" title="Facebook"><svg className="inline w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35C.595 0 0 .592 0 1.326v21.348C0 23.408.595 24 1.326 24H12.82v-9.294H9.692v-3.622h3.127V8.413c0-3.1 1.893-4.788 4.659-4.788c1.325 0 2.463.099 2.797.143v3.24l-1.918.001c-1.504 0-1.797.715-1.797 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.406 24 24 23.408 24 22.674V1.326C24 .592 23.406 0 22.675 0"/></svg></a>
          <a href="https://youtube.com/@urbansetu" target="_blank" rel="noopener noreferrer" title="YouTube"><svg className="inline w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a2.994 2.994 0 0 0-2.112-2.112C19.454 3.5 12 3.5 12 3.5s-7.454 0-9.386.574A2.994 2.994 0 0 0 .502 6.186C0 8.118 0 12 0 12s0 3.882.502 5.814a2.994 2.994 0 0 0 2.112 2.112C4.546 20.5 12 20.5 12 20.5s7.454 0 9.386-.574a2.994 2.994 0 0 0 2.112-2.112C24 15.882 24 12 24 12s0-3.882-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
        </div>
        <div className="text-xs text-gray-500 mt-2">&copy; {new Date().getFullYear()} UrbanSetu. All rights reserved.</div>
      </div>
    </div>
  )
}
