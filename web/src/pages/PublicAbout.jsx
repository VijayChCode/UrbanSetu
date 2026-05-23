import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/auth';
import { AnimatePresence, motion } from 'framer-motion';
import AboutSkeleton from '../components/skeletons/AboutSkeleton';
import { Link } from 'react-router-dom';
import { FaBullseye, FaGlobe, FaUsers, FaShieldAlt, FaUserFriends, FaStar, FaEye, FaCog, FaRocket, FaHeart, FaLock, FaCheckCircle, FaQuestionCircle, FaChevronDown, FaChevronUp, FaEnvelope } from 'react-icons/fa';
import ContactSupportWrapper from '../components/ContactSupportWrapper';

import SEO from '../components/SEO';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

export default function PublicAbout() {
  // SEO Meta Tags
  const seoTitle = "About UrbanSetu - Our Mission & Vision";
  const seoDescription = "Learn about UrbanSetu, India's most verified real estate platform. Discover our journey, meet our founder Bhavith Tungena, and understand how we ensure property trust.";

  const [aboutData, setAboutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/about`, { autoRedirect: false });
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
      <>
        <SEO
          title={seoTitle}
          description={seoDescription}
          keywords="about urbansetu, real estate platform india, bhavith tungena, property mission"
        />
        <div className="sr-only">
          <h2>About UrbanSetu · India's Verified Real Estate Platform</h2>
          <p>UrbanSetu is a smart real estate ecosystem founded by Bhavith Tungena, dedicated to transforming the property landscape in India. Our mission is to provide unparalleled trust and transparency in property transactions through advanced AI-powered verification, 3D virtual tours, and secure communication channels. We believe that everyone deserves a reliable and efficient way to find their dream home or investment property without the traditional hassles of the real estate market.</p>
          <p>As a technology-first company, UrbanSetu leverages cutting-edge tools to verify Every listing on our platform. From residential apartments in Hyderabad to commercial spaces in Bangalore, our team ensures that users have access to accurate information and high-quality imagery. Our platform is not just about listing properties; it's about building a community where buyers, sellers, and renters can interact with confidence and security.</p>
          <p>Our journey began with a simple goal: to make real estate accessible and transparent. Today, under the leadership of Bhavith Tungena, UrbanSetu has grown into a comprehensive platform offering a wide range of services including Rent Lock, real-time market insights, and expert property guides. We are committed to continuous innovation and excellence, ensuring that UrbanSetu remains the #1 choice for smart real estate in India. Join us as we redefine the future of property transactions.</p>
          <nav>
            <a href="/">Home</a>
            <a href="/search?type=sale">Buy Properties</a>
            <a href="/search?type=rent">Rent Properties</a>
            <a href="/blogs">Latest Real Estate News</a>
            <a href="/guides">First-Time Home Buyer Guides</a>
            <a href="/about">About Us</a>
            <a href="/contact">Get in Touch</a>
          </nav>
        </div>
        <AboutSkeleton />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords="about urbansetu, real estate platform india, bhavith tungena, property verification mission"
      />
      {/* Background Animations */}
      <style>
        {`
            @keyframes blob {
                0% { transform: translate(0px, 0px) scale(1); }
                33% { transform: translate(30px, -50px) scale(1.1); }
                66% { transform: translate(-20px, 20px) scale(0.9); }
                100% { transform: translate(0px, 0px) scale(1); }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-blob { animation: blob 7s infinite; }
            .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
            .animate-fade-in-delay { animation: fadeIn 0.6s ease-out 0.2s forwards; opacity: 0; }
        `}
      </style>

      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-400 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-overlay filter blur-3xl opacity-20 animate-blob" style={{ animationDelay: "4s" }}></div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10 animate-fade-in">

        {/* 1. Introduction / Hero Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 text-center border border-transparent dark:border-gray-800 transition-colors">
          <h1 className="text-5xl font-extrabold text-blue-700 dark:text-blue-400 mb-6 drop-shadow flex items-center justify-center gap-3">
            <FaGlobe className="text-blue-400 dark:text-blue-300" /> {aboutData.heroTitle || 'Welcome to UrbanSetu'}
          </h1>
          <p className="text-xl text-slate-700 dark:text-gray-300 font-medium max-w-4xl mx-auto leading-relaxed">
            {aboutData.heroText || ''}
          </p>
        </div>

        {/* 2. Mission & Vision */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
            <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 flex items-center justify-center gap-3 mb-4">
              <FaBullseye className="text-purple-500 dark:text-purple-300" /> Our Mission
            </h2>
            <p className="text-slate-700 dark:text-gray-300 text-lg leading-relaxed">
              {aboutData.mission || ''}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
            <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center justify-center gap-3 mb-4">
              <FaEye className="text-blue-500 dark:text-blue-300" /> Our Vision
            </h2>
            <p className="text-slate-700 dark:text-gray-300 text-lg leading-relaxed">
              {aboutData.vision || ''}
            </p>
          </div>
        </div>

        {/* 3. Core Values & Department Contacts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Core Values (Spans 2 columns on desktop) */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
            <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 flex items-center gap-3 mb-6 text-center justify-center lg:justify-start">
              <FaHeart className="text-green-500" /> Our Core Values
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(aboutData.coreValues || []).map((value, idx) => (
                <div key={idx} className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/40 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">{value.title}</h3>
                  <p className="text-slate-700 dark:text-gray-300 text-sm leading-relaxed">{value.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Departmental Contacts (Spans 1 column on desktop) */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors flex flex-col">
            <h2 className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-3 mb-6 text-center justify-center lg:justify-start">
              <FaEnvelope className="text-indigo-500 animate-pulse" /> Direct Contact
            </h2>
            <p className="text-slate-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
              Have specific queries? Reach out to our dedicated departments directly for faster response:
            </p>
            <div className="space-y-4 flex-1">
              {/* Support */}
              <a 
                href="mailto:urbansetu.noreply@gmail.com" 
                className="group flex items-start gap-4 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/30 to-white dark:from-blue-900/10 dark:to-gray-900 hover:shadow-md transition-all duration-300 transform hover:scale-[1.01]"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-115 transition-transform duration-300 flex-shrink-0">
                  <FaEnvelope className="text-base" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Support & Feedback</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 break-all font-medium">urbansetu.noreply@gmail.com</p>
                </div>
              </a>

              {/* General Inquiries */}
              <a 
                href="mailto:info.urbansetu@gmail.com" 
                className="group flex items-start gap-4 p-4 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/30 to-white dark:from-amber-900/10 dark:to-gray-900 hover:shadow-md transition-all duration-300 transform hover:scale-[1.01]"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-115 transition-transform duration-300 flex-shrink-0">
                  <span className="text-base font-bold">ℹ️</span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">General Inquiries</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 break-all font-medium">info.urbansetu@gmail.com</p>
                </div>
              </a>

              {/* Legal & Auth */}
              <a 
                href="mailto:auth.urbansetu@gmail.com" 
                className="group flex items-start gap-4 p-4 rounded-xl border border-green-100 dark:border-green-900/40 bg-gradient-to-br from-green-50/30 to-white dark:from-green-900/10 dark:to-gray-900 hover:shadow-md transition-all duration-300 transform hover:scale-[1.01]"
              >
                <div className="w-10 h-10 rounded-xl bg-green-500/10 dark:bg-green-400/10 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-115 transition-transform duration-300 flex-shrink-0">
                  <FaShieldAlt className="text-base" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Accounts & Legal</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 break-all font-medium">auth.urbansetu@gmail.com</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* 4. How UrbanSetu Works */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
          <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-3 mb-8 text-center justify-center">
            <FaCog className="text-blue-500 dark:text-blue-300" /> How UrbanSetu Works
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {(aboutData.howItWorks ? Object.entries(aboutData.howItWorks) : []).map(([_, section]) => (
              <div key={_} className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-6 border border-blue-200 dark:border-blue-800 transition-colors">
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                  <FaRocket className="text-blue-600 dark:text-blue-400" /> {section.title}
                </h3>
                <ul className="space-y-3">
                  {(section.steps || []).map((step, stepIdx) => (
                    <li key={stepIdx} className="flex items-start gap-3 text-slate-700 dark:text-gray-300 transition-colors">
                      <FaCheckCircle className="text-green-500 dark:text-green-400 mt-1 flex-shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Key Features */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
          <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-3 mb-6 text-center justify-center">
            <FaStar className="text-yellow-500 dark:text-yellow-400" /> Key Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(aboutData.features || []).map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/40 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
                <FaCheckCircle className="text-green-500 dark:text-green-400 flex-shrink-0" />
                <span className="text-slate-700 dark:text-gray-300 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Our Journey */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 flex items-center gap-3 mb-6 text-center justify-center">
            <FaRocket className="text-purple-500 dark:text-purple-400" /> {aboutData.journey?.title || 'Our Journey'}
          </h2>
          <p className="text-lg text-slate-700 dark:text-gray-300 text-center mb-8 max-w-4xl mx-auto leading-relaxed transition-colors">
            {aboutData.journey?.story || ''}
          </p>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500 opacity-50"></div>
            <div className="space-y-8">
              {(aboutData.journey?.milestones || []).map((milestone, idx) => (
                <div key={idx} className="relative flex items-start gap-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 relative z-10 shadow-lg">
                    {milestone.year}
                  </div>
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/40 rounded-lg p-6 border border-gray-200 dark:border-gray-700 flex-1 transition-all">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{milestone.title}</h3>
                    <p className="text-slate-700 dark:text-gray-300">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 7. Who We Serve */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
          <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 flex items-center gap-3 mb-6 text-center justify-center">
            <FaUsers className="text-green-500 dark:text-green-400" /> Who We Serve
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(aboutData.whoWeServe || []).map((audience, idx) => (
              <div key={idx} className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800 text-center hover:shadow-md transition-all">
                <FaUsers className="text-green-500 dark:text-green-400 text-3xl mx-auto mb-4" />
                <p className="text-slate-700 dark:text-gray-300 font-medium">{audience}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Team Section */}
        <div className="space-y-8">
          {/* CEO Spotlight */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-transparent dark:border-gray-800 p-8 transition-colors">
            <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 flex items-center gap-3 mb-8 text-center justify-center">
              <FaUserFriends className="text-purple-500" /> Leadership Spotlight
            </h2>
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12 max-w-6xl mx-auto">
              {/* Left: Main Profile */}
              <div className="flex-1 text-center lg:text-left">
                <div className="w-56 h-56 mx-auto lg:mx-0 relative rounded-full overflow-hidden border-4 border-purple-500 shadow-2xl mb-6 transform hover:scale-105 transition-transform duration-300">
                  <img src="/images/bhavith_ceo.png" alt="Bhavith Tungena" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-3xl font-extrabold text-gray-800 dark:text-white mb-2">Bhavith Tungena</h3>
                <div className="inline-block bg-blue-100 dark:bg-blue-900/30 px-4 py-1 rounded-full mb-4">
                  <p className="text-blue-700 dark:text-blue-400 font-bold text-lg">CEO & Founder</p>
                </div>
                <p className="text-lg text-slate-600 dark:text-gray-300 italic mb-6 leading-relaxed">
                  "Innovating at the intersection of Real Estate and Artificial Intelligence."
                </p>
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-purple-100 dark:border-purple-800 shadow-sm text-left">
                  <h4 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <FaRocket className="text-purple-500" /> Visionary & Technologist
                  </h4>
                  <p className="text-slate-600 dark:text-gray-400 mb-4 leading-relaxed">
                    A visionary leader and motivational speaker with immense experience in real estate and software development.
                    Expertise in <strong>Machine Learning, Data Science, and GenAI</strong>.
                    Currently pursuing engineering at <span className="text-purple-600 dark:text-purple-400 font-medium">Kakatiya Institute of Technology & Science, Warangal (2022-2026)</span>.
                  </p>
                  <a href="https://www.linkedin.com/in/bhavith-tungena-b6689727a/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg font-medium transition-all shadow-md hover:shadow-lg">
                    <FaGlobe /> Connect on LinkedIn
                  </a>
                </div>
              </div>

              {/* Right: Featured Moments / Gallery */}
              <div className="flex-1 w-full max-w-md lg:max-w-none">
                <div className="grid grid-cols-2 gap-4 relative">
                  <div className="col-span-1 row-span-2 rounded-2xl overflow-hidden shadow-xl h-80 transform rotate-2 hover:rotate-0 transition-all duration-500 border-2 border-white dark:border-gray-800">
                    <img src="/images/bhavith_ceo_2.jpg" alt="Bhavith Tungena - Speaking" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
                  </div>
                  <div className="col-span-1 rounded-2xl overflow-hidden shadow-xl h-36 transform -rotate-2 hover:rotate-0 transition-all duration-500 border-2 border-white dark:border-gray-800 mt-4">
                    <img src="/images/bhavith_ceo_3.jpg" alt="Bhavith Tungena - Event" className="w-full h-full object-cover object-top hover:scale-110 transition-transform duration-700" />
                  </div>
                  <div className="col-span-1 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white h-36 border-2 border-white dark:border-gray-800 shadow-xl transform rotate-1 hover:rotate-0 transition-all duration-500">
                    <div className="text-center p-4">
                      <FaStar className="text-3xl mx-auto mb-2 text-yellow-300" />
                      <span className="font-bold text-sm">Most Eligible & Motivational Speaker</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
            <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 flex items-center gap-3 mb-6 text-center justify-center">
              <FaUserFriends className="text-purple-500 dark:text-purple-400" /> Meet Our Team
            </h2>
            <p className="text-lg text-slate-700 dark:text-gray-300 text-center mb-8 max-w-4xl mx-auto transition-colors">
              {aboutData.team || ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(aboutData.teamMembers || []).map((member, idx) => (
                <div key={idx} className="bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/30 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center hover:shadow-md transition-all">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-md">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 transition-colors">{member.name}</h3>
                  <p className="text-blue-600 dark:text-blue-400 font-medium mb-2 transition-colors">{member.role}</p>
                  <p className="text-sm text-slate-600 dark:text-gray-400 transition-colors">{member.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 9. Trust & Security */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
          <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-3 mb-6 text-center justify-center">
            <FaShieldAlt className="text-blue-500 dark:text-blue-300" /> Trust & Security
          </h2>
          <p className="text-lg text-slate-700 dark:text-gray-300 text-center max-w-4xl mx-auto leading-relaxed transition-colors">
            {aboutData.trust || ''}
          </p>
        </div>

        {/* 10. FAQ Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-800 transition-colors">
          <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 flex items-center gap-3 mb-8 text-center justify-center">
            <FaQuestionCircle className="text-green-500 dark:text-green-400" /> Frequently Asked Questions
          </h2>
          <div className="space-y-4 max-w-4xl mx-auto">
            {(aboutData.faqs || []).map((faq, idx) => (
              <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-colors">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full p-6 text-left bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/40 hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/60 transition-all duration-200 flex items-center justify-between"
                >
                  <span className="font-semibold text-gray-800 dark:text-white transition-colors">{faq.question}</span>
                  {expandedFaq === idx ? (
                    <FaChevronUp className="text-blue-600 dark:text-blue-400" />
                  ) : (
                    <FaChevronDown className="text-blue-600 dark:text-blue-400" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 transition-colors">
                        <p className="text-slate-700 dark:text-gray-300 leading-relaxed transition-colors">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* 11. Share Your Feedback */}
        <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-900/20 dark:via-gray-900 dark:to-blue-900/20 rounded-xl shadow-lg p-8 text-center transition-colors border border-purple-100 dark:border-purple-800/50">
          <span className="text-4xl mb-3 block">📋</span>
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 mb-3">Share Your Feedback</h2>
          <p className="text-slate-600 dark:text-gray-300 text-lg max-w-2xl mx-auto mb-2 leading-relaxed">
            Your voice shapes the future of UrbanSetu. Tell us what you love, what needs improvement, and what features you'd like to see next.
          </p>
          <p className="text-amber-600 dark:text-amber-400 font-semibold text-sm mb-6">
            🪙 Fill the survey & earn 10 SetuCoins!
          </p>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfczXodXme_kSsff2XNktDp6y9r0DyXm_abV9VIqK3PcBKhVg/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3.5 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            📋 Take the 2-Minute Survey
          </a>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-3">Takes ~2 minutes • Completely anonymous • Helps us build better</p>
        </div>
      </div>
      <ContactSupportWrapper />
    </div>
  );
}
