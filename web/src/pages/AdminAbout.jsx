import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import AboutSkeleton from '../components/skeletons/AboutSkeleton';
import { FaBullseye, FaGlobe, FaUsers, FaShieldAlt, FaUserFriends, FaStar, FaEdit, FaEye, FaCog, FaRocket, FaHeart, FaLock, FaCheckCircle, FaQuestionCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { authenticatedFetch } from '../utils/auth';

import { usePageTitle } from '../hooks/usePageTitle';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://urbansetu-pvt4.onrender.com';

export default function AdminAbout() {
  // Set page title
  usePageTitle("About Management - Admin Panel");

  const [aboutData, setAboutData] = useState(null);
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const { currentUser } = useSelector((state) => state.user) || {};
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/about`);
        if (response.ok) {
          const data = await response.json();
          setAboutData(data);
        }
      } catch (err) {
        setError('Failed to fetch About data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAboutData();
  }, []);

  const handleEdit = () => {
    setEditData({
      heroTitle: aboutData.heroTitle || 'Welcome to UrbanSetu',
      heroText: aboutData.heroText || '',
      mission: aboutData.mission || '',
      vision: aboutData.vision || '',
      features: aboutData.features ? [...aboutData.features] : [],
      whoWeServe: aboutData.whoWeServe ? [...aboutData.whoWeServe] : [],
      coreValues: aboutData.coreValues ? [...aboutData.coreValues] : [],
      howItWorks: aboutData.howItWorks || {
        buyers: { title: '', steps: [] },
        sellers: { title: '', steps: [] },
        admins: { title: '', steps: [] }
      },
      journey: aboutData.journey || { title: '', story: '', milestones: [] },
      team: aboutData.team || '',
      teamMembers: aboutData.teamMembers ? [...aboutData.teamMembers] : [],
      faqs: aboutData.faqs ? [...aboutData.faqs] : [],
      trust: aboutData.trust || '',
      contact: aboutData.contact || '',
      socialLinks: aboutData.socialLinks || {
        email: '',
        instagram: '',
        x: '',
        facebook: '',
        youtube: ''
      },
      customFields: aboutData.customFields ? [...aboutData.customFields] : [],
    });
    setEditMode(true);
    setSuccess(false);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleListChange = (name, idx, value) => {
    setEditData((prev) => ({
      ...prev,
      [name]: prev[name].map((item, i) => (i === idx ? value : item)),
    }));
  };

  const handleAddListItem = (name) => {
    setEditData((prev) => ({ ...prev, [name]: [...prev[name], ''] }));
  };

  const handleRemoveListItem = (name, idx) => {
    setEditData((prev) => ({ ...prev, [name]: prev[name].filter((_, i) => i !== idx) }));
  };

  const handleSave = () => {
    setShowPasswordModal(true);
    setPassword('');
    setPasswordError('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!password) {
      setPasswordError('Password is required');
      return;
    }
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Password correct, proceed to save changes
        setShowPasswordModal(false);
        await doSaveEdit();
      } else {
        setPasswordError('Incorrect password, no information changed');
      }
    } catch (err) {
      setPasswordError('Incorrect password, no information changed');
    }
  };

  const doSaveEdit = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/about`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        setAboutData(editData);
        setEditMode(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError('Failed to save changes.');
      }
    } catch (err) {
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditData(null);
    setError('');
    setSuccess(false);
  };

  // Custom fields handlers
  const handleCustomFieldChange = (idx, field, value) => {
    setEditData((prev) => ({
      ...prev,
      customFields: prev.customFields.map((item, i) => i === idx ? { ...item, [field]: value } : item)
    }));
  };
  const handleAddCustomField = () => {
    setEditData((prev) => ({
      ...prev,
      customFields: [...prev.customFields, { key: '', value: '' }]
    }));
  };
  const handleRemoveCustomField = (idx) => {
    setEditData((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== idx)
    }));
  };

  if (loading || !aboutData) {
    return <AboutSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
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
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 dark:opacity-10 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 dark:opacity-10 animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-400 dark:bg-pink-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 dark:opacity-10 animate-blob" style={{ animationDelay: "4s" }}></div>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-6 relative z-10 animate-fade-in transition-colors">
        {/* Edit/View Mode Toggle */}
        <div className="flex justify-end items-center mb-4">
          {!editMode && (
            <button
              onClick={handleEdit}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg font-semibold flex items-center gap-2"
            >
              <FaEdit /> Edit
            </button>
          )}
        </div>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        {success && <div className="text-green-600 mb-2">Saved successfully!</div>}
        {/* VIEW MODE */}
        {!editMode && (
          <div className="space-y-8">
            {/* 1. Introduction / Hero Section */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-8 text-center transition-colors">
              <h1 className="text-5xl font-extrabold text-blue-700 dark:text-blue-400 mb-6 drop-shadow flex items-center justify-center gap-3">
                <FaGlobe className="text-blue-400" /> {aboutData.heroTitle || 'Welcome to UrbanSetu'}
              </h1>
              <p className="text-xl text-slate-700 dark:text-gray-300 font-medium max-w-4xl mx-auto leading-relaxed">
                {aboutData.heroText || ''}
              </p>
            </div>

            {/* 2. Mission & Vision */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-purple-900/10 p-8 transition-colors">
                <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 flex items-center justify-center gap-3 mb-4">
                  <FaBullseye className="text-purple-500" /> Our Mission
                </h2>
                <p className="text-slate-700 dark:text-gray-300 text-lg leading-relaxed">
                  {aboutData.mission || ''}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-8 transition-colors">
                <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center justify-center gap-3 mb-4">
                  <FaEye className="text-blue-500" /> Our Vision
                </h2>
                <p className="text-slate-700 dark:text-gray-300 text-lg leading-relaxed">
                  {aboutData.vision || ''}
                </p>
              </div>
            </div>

            {/* 3. Core Values */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-green-900/10 p-8 transition-colors">
              <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 flex items-center gap-3 mb-6 text-center justify-center">
                <FaHeart className="text-green-500" /> Our Core Values
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(aboutData.coreValues || []).map((value, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">{value.title}</h3>
                    <p className="text-slate-700 dark:text-gray-300">{value.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. How UrbanSetu Works */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-8 transition-colors">
              <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-3 mb-8 text-center justify-center">
                <FaCog className="text-blue-500" /> How UrbanSetu Works
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {(aboutData.howItWorks ? Object.entries(aboutData.howItWorks) : []).map(([key, section], idx) => (
                  <div key={key} className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800 transition-colors">
                    <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                      <FaRocket className="text-blue-600 dark:text-blue-400" /> {section.title}
                    </h3>
                    <ul className="space-y-3">
                      {(section.steps || []).map((step, stepIdx) => (
                        <li key={stepIdx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
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
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-8 transition-colors">
              <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-3 mb-6 text-center justify-center">
                <FaStar className="text-yellow-500" /> Key Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(aboutData.features || []).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                    <FaCheckCircle className="text-green-500 dark:text-green-400 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-gray-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Our Journey */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-purple-900/10 p-8 transition-colors">
              <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 flex items-center gap-3 mb-6 text-center justify-center">
                <FaRocket className="text-purple-500" /> {aboutData.journey?.title || 'Our Journey'}
              </h2>
              <p className="text-lg text-slate-700 dark:text-gray-300 text-center mb-8 max-w-4xl mx-auto leading-relaxed">
                {aboutData.journey?.story || ''}
              </p>
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500"></div>
                <div className="space-y-8">
                  {(aboutData.journey?.milestones || []).map((milestone, idx) => (
                    <div key={idx} className="relative flex items-start gap-6">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 relative z-10 shadow-lg">
                        {milestone.year}
                      </div>
                      <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg p-6 border border-gray-200 dark:border-gray-700 flex-1 transition-colors">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{milestone.title}</h3>
                        <p className="text-slate-700 dark:text-gray-300">{milestone.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 7. Who We Serve */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-green-900/10 p-8 transition-colors">
              <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 flex items-center gap-3 mb-6 text-center justify-center">
                <FaUsers className="text-green-500" /> Who We Serve
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
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-purple-900/10 p-8 transition-colors">
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
                    <div className="inline-block bg-blue-100 dark:bg-blue-900/40 px-4 py-1 rounded-full mb-4">
                      <p className="text-blue-700 dark:text-blue-300 font-bold text-lg">CEO & Founder</p>
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

              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-purple-900/10 p-8 transition-colors">
                <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-400 flex items-center gap-3 mb-6 text-center justify-center">
                  <FaUserFriends className="text-purple-500" /> Meet Our Team
                </h2>
                <p className="text-lg text-slate-700 dark:text-gray-300 text-center mb-8 max-w-4xl mx-auto">
                  {aboutData.team || ''}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {(aboutData.teamMembers || []).map((member, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/20 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center hover:shadow-md transition-all">
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
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-8 transition-colors">
              <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-3 mb-6 text-center justify-center">
                <FaShieldAlt className="text-blue-500" /> Trust & Security
              </h2>
              <p className="text-lg text-slate-700 dark:text-gray-300 text-center max-w-4xl mx-auto leading-relaxed">
                {aboutData.trust || ''}
              </p>
            </div>

            {/* 10. FAQ Section */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-green-900/10 p-8 transition-colors">
              <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 flex items-center gap-3 mb-8 text-center justify-center">
                <FaQuestionCircle className="text-green-500" /> Frequently Asked Questions
              </h2>
              <div className="space-y-4 max-w-4xl mx-auto">
                {(aboutData.faqs || []).map((faq, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-colors">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      className="w-full p-6 text-left bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-blue-900/30 transition-all duration-200 flex items-center justify-between"
                    >
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{faq.question}</span>
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
                          <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-colors">
                            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{faq.answer}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>



            {/* 12. Additional Information (Custom Fields) */}
            {aboutData.customFields && aboutData.customFields.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg dark:shadow-blue-900/10 p-8 transition-colors">
                <h2 className="text-3xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-3 mb-6 text-center justify-center">
                  <FaGlobe className="text-blue-400" /> Additional Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aboutData.customFields.map((item, idx) => (
                    <div key={idx} className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg p-4 border border-gray-200 dark:border-gray-700 transition-colors">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{item.key}</h3>
                      <p className="text-slate-700 dark:text-gray-300">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 12. Share Your Feedback */}
            <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-900/20 dark:via-gray-900 dark:to-blue-900/20 rounded-xl shadow-lg dark:shadow-purple-900/10 p-8 text-center transition-colors border border-purple-100 dark:border-purple-800/50">
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
        )}
        {/* EDIT MODE */}
        {editMode && (
          <>
            <div className="flex items-center gap-2 mb-6">
              <FaEdit className="text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Edit Information</h2>
            </div>
            {/* Hero Section */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 dark:text-gray-200">Hero Title</label>
              <input name="heroTitle" value={editData.heroTitle} onChange={handleChange} className="w-full border rounded p-2 mb-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              <label className="block font-semibold mb-1 dark:text-gray-200">Hero Text</label>
              <textarea name="heroText" value={editData.heroText} onChange={handleChange} className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" rows={2} />
            </div>
            {/* Mission */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2 dark:text-gray-200"><FaBullseye className="text-purple-500" /> Our Mission</label>
              <textarea name="mission" value={editData.mission} onChange={handleChange} className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" rows={2} />
            </div>
            {/* Features */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2 dark:text-gray-200"><FaStar className="text-yellow-500" /> What We Offer</label>
              {editData.features.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input value={item} onChange={e => handleListChange('features', idx, e.target.value)} className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                  <button type="button" onClick={() => handleRemoveListItem('features', idx)} className="text-red-500 font-bold">&times;</button>
                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem('features')} className="text-blue-600 dark:text-blue-400 underline">+ Add Feature</button>
            </div>
            {/* Who We Serve */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2 dark:text-gray-200"><FaUsers className="text-green-500" /> Who We Serve</label>
              {editData.whoWeServe.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input value={item} onChange={e => handleListChange('whoWeServe', idx, e.target.value)} className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                  <button type="button" onClick={() => handleRemoveListItem('whoWeServe', idx)} className="text-red-500 font-bold">&times;</button>
                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem('whoWeServe')} className="text-blue-600 dark:text-blue-400 underline">+ Add Audience</button>
            </div>
            {/* Trust & Transparency */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2 dark:text-gray-200"><FaShieldAlt className="text-blue-500" /> Trust & Transparency</label>
              <textarea name="trust" value={editData.trust} onChange={handleChange} className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" rows={2} />
            </div>
            {/* Our Team */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2 dark:text-gray-200"><FaUserFriends className="text-purple-500" /> Our Team</label>
              <textarea name="team" value={editData.team} onChange={handleChange} className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" rows={2} />
            </div>

            {/* Additional Information (Custom Fields) */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2 dark:text-gray-200"><FaGlobe className="text-blue-400" /> Additional Information</label>
              {(editData.customFields || []).map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    placeholder="Field Name"
                    value={item.key}
                    onChange={e => handleCustomFieldChange(idx, 'key', e.target.value)}
                    className="w-1/3 border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                  <input
                    placeholder="Field Value"
                    value={item.value}
                    onChange={e => handleCustomFieldChange(idx, 'value', e.target.value)}
                    className="w-2/3 border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                  <button type="button" onClick={() => handleRemoveCustomField(idx)} className="text-red-500 font-bold">&times;</button>
                </div>
              ))}
              <button type="button" onClick={handleAddCustomField} className="text-blue-600 dark:text-blue-400 underline">+ Add Field</button>
            </div>
            <div className="flex gap-4 mt-4">
              <button onClick={handleSave} disabled={saving} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleCancel} disabled={saving} className="bg-gray-300 text-gray-800 px-6 py-2 rounded font-bold hover:bg-gray-400 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </>
        )}
        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <form onSubmit={handlePasswordSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4">
              <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><FaEdit /> Confirm Password</h3>
              <input
                type="password"
                className="border rounded p-2 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              {passwordError && <div className="text-red-600 dark:text-red-400 text-sm">{passwordError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold hover:bg-blue-800">Confirm</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
