import React, { useState, useEffect } from 'react'
import ContactSupportWrapper from '../components/ContactSupportWrapper'
import { FaBullseye, FaGlobe, FaUsers, FaShieldAlt, FaUserFriends, FaEnvelope, FaStar } from 'react-icons/fa';
import { useSelector } from 'react-redux';

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
      <div className="bg-gradient-to-br from-blue-50 to-purple-100 min-h-screen py-10 px-2 md:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 relative">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
          </div>
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
      <ContactSupportWrapper />
    </div>
  )
}
