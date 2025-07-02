import React, { useState, useEffect } from 'react';
import ContactSupportWrapper from '../components/ContactSupportWrapper';
import { FaBullseye, FaGlobe, FaUsers, FaShieldAlt, FaUserFriends, FaEnvelope, FaStar, FaEdit } from 'react-icons/fa';
import { useSelector } from 'react-redux';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminAbout() {
  const [aboutData, setAboutData] = useState(null);
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const { currentUser } = useSelector((state) => state.user) || {};
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/about`);
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
      features: aboutData.features ? [...aboutData.features] : [],
      whoWeServe: aboutData.whoWeServe ? [...aboutData.whoWeServe] : [],
      trust: aboutData.trust || '',
      team: aboutData.team || '',
      contact: aboutData.contact || '',
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
      const res = await fetch(`${API_BASE_URL}/api/user/verify-password/${currentUser._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      const res = await fetch(`${API_BASE_URL}/api/about`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
        credentials: 'include'
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
          <>
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
            {/* 8. Additional Information (Custom Fields) */}
            {aboutData.customFields && aboutData.customFields.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2 mb-2">
                  <FaGlobe className="text-blue-400" /> Additional Information
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-slate-700 text-lg">
                  {aboutData.customFields.map((item, idx) => (
                    <li key={idx}><span className="font-semibold">{item.key}:</span> {item.value}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {/* EDIT MODE */}
        {editMode && (
          <>
            <div className="flex items-center gap-2 mb-6">
              <FaEdit className="text-blue-600" />
              <h2 className="text-2xl font-bold text-blue-700">Edit Information</h2>
            </div>
            {/* Hero Section */}
            <div className="mb-6">
              <label className="block font-semibold mb-1">Hero Title</label>
              <input name="heroTitle" value={editData.heroTitle} onChange={handleChange} className="w-full border rounded p-2 mb-2" />
              <label className="block font-semibold mb-1">Hero Text</label>
              <textarea name="heroText" value={editData.heroText} onChange={handleChange} className="w-full border rounded p-2" rows={2} />
            </div>
            {/* Mission */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2"><FaBullseye className="text-purple-500" /> Our Mission</label>
              <textarea name="mission" value={editData.mission} onChange={handleChange} className="w-full border rounded p-2" rows={2} />
            </div>
            {/* Features */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2"><FaStar className="text-yellow-500" /> What We Offer</label>
              {editData.features.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input value={item} onChange={e => handleListChange('features', idx, e.target.value)} className="w-full border rounded p-2" />
                  <button type="button" onClick={() => handleRemoveListItem('features', idx)} className="text-red-500 font-bold">&times;</button>
                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem('features')} className="text-blue-600 underline">+ Add Feature</button>
            </div>
            {/* Who We Serve */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2"><FaUsers className="text-green-500" /> Who We Serve</label>
              {editData.whoWeServe.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input value={item} onChange={e => handleListChange('whoWeServe', idx, e.target.value)} className="w-full border rounded p-2" />
                  <button type="button" onClick={() => handleRemoveListItem('whoWeServe', idx)} className="text-red-500 font-bold">&times;</button>
                </div>
              ))}
              <button type="button" onClick={() => handleAddListItem('whoWeServe')} className="text-blue-600 underline">+ Add Audience</button>
            </div>
            {/* Trust & Transparency */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2"><FaShieldAlt className="text-blue-500" /> Trust & Transparency</label>
              <textarea name="trust" value={editData.trust} onChange={handleChange} className="w-full border rounded p-2" rows={2} />
            </div>
            {/* Our Team */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2"><FaUserFriends className="text-purple-500" /> Our Team</label>
              <textarea name="team" value={editData.team} onChange={handleChange} className="w-full border rounded p-2" rows={2} />
            </div>
            {/* Contact & Support */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2"><FaEnvelope className="text-green-500" /> Contact & Support</label>
              <textarea name="contact" value={editData.contact} onChange={handleChange} className="w-full border rounded p-2" rows={2} />
            </div>
            {/* Additional Information (Custom Fields) */}
            <div className="mb-6">
              <label className="block font-semibold mb-1 flex items-center gap-2"><FaGlobe className="text-blue-400" /> Additional Information</label>
              {(editData.customFields || []).map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    placeholder="Field Name"
                    value={item.key}
                    onChange={e => handleCustomFieldChange(idx, 'key', e.target.value)}
                    className="w-1/3 border rounded p-2"
                  />
                  <input
                    placeholder="Field Value"
                    value={item.value}
                    onChange={e => handleCustomFieldChange(idx, 'value', e.target.value)}
                    className="w-2/3 border rounded p-2"
                  />
                  <button type="button" onClick={() => handleRemoveCustomField(idx)} className="text-red-500 font-bold">&times;</button>
                </div>
              ))}
              <button type="button" onClick={handleAddCustomField} className="text-blue-600 underline">+ Add Field</button>
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
            <form onSubmit={handlePasswordSubmit} className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col gap-4">
              <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2"><FaEdit /> Confirm Password</h3>
              <input
                type="password"
                className="border rounded p-2 w-full"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              {passwordError && <div className="text-red-600 text-sm">{passwordError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white font-semibold">Confirm</button>
              </div>
            </form>
          </div>
        )}
      </div>
      <ContactSupportWrapper />
    </div>
  );
}
