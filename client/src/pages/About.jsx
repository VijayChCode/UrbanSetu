import React, { useState, useEffect } from 'react'
import ContactSupportWrapper from '../components/ContactSupportWrapper'

export default function About() {
  const [aboutData, setAboutData] = useState({
    title: "About Real Estate",
    content: "Real Estate is a leading real estate agency that specializes in helping clients buy, sell, and rent properties in the most desirable neighborhoods. Our team of experienced agents is dedicated to providing exceptional service and making the buying and selling process as smooth as possible.",
    paragraphs: [
      "Our mission is to help our clients achieve their real estate goals by providing expert advice, personalized service, and a deep understanding of the local market. Whether you are looking to buy, sell, or rent a property, we are here to help you every step of the way.",
      "Our team of agents has a wealth of experience and knowledge in the real estate industry, and we are committed to providing the highest level of service to our clients. We believe that buying or selling a property should be an exciting and rewarding experience, and we are dedicated to making that a reality for each and every one of our clients."
    ],
    lastUpdated: null,
    updatedBy: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const response = await fetch('/api/about');
        if (response.ok) {
          const data = await response.json();
          setAboutData(data);
        }
      } catch (error) {
        console.error('Error fetching about data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAboutData();
  }, []);

  if (loading) {
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
        <h3 className="text-3xl font-extrabold text-blue-700 mb-6 text-center drop-shadow">
          {aboutData.title}
        </h3>
        <div className="space-y-4">
          <p className="text-slate-700 text-lg leading-relaxed">{aboutData.content}</p>
          {aboutData.paragraphs && aboutData.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-slate-700 text-lg leading-relaxed">{paragraph}</p>
          ))}
        </div>
        {(aboutData.lastUpdated || aboutData.updatedBy) && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            {aboutData.lastUpdated && (
              <p className="text-sm text-gray-600">
                <strong>Last updated:</strong> {new Date(aboutData.lastUpdated).toLocaleString()}
              </p>
            )}
            {aboutData.updatedBy && (
              <p className="text-sm text-gray-600">
                <strong>Updated by:</strong> {aboutData.updatedBy}
              </p>
            )}
          </div>
        )}
      </div>
      <ContactSupportWrapper />
    </div>
  )
}
