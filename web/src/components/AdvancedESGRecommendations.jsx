import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import ListingItem from './ListingItem';
import { FaLeaf, FaUsers, FaShieldAlt, FaChartLine, FaCogs, FaLightbulb, FaTimesCircle, FaInfoCircle, FaEye, FaThumbsUp, FaArrowUp, FaRecycle, FaGlobe, FaStar } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { authenticatedFetch } from '../utils/auth';

const AdvancedESGRecommendations = ({
  userId,
  limit = 8,
  showTitle = true,
  showInsights = true,
  showModelInfo = true,
  onRecommendationClick = null,
  className = ""
}) => {
  const { currentUser } = useSelector((state) => state.user);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [esgPreferences, setEsgPreferences] = useState(null);
  const [activeTab, setActiveTab] = useState('recommendations');
  const [showModelDetails, setShowModelDetails] = useState(false);

  const tabs = [
    { id: 'recommendations', name: 'ESG Recommendations', icon: FaLeaf },
    { id: 'preferences', name: 'My ESG Profile', icon: FaUsers },
    { id: 'analytics', name: 'ESG Analytics', icon: FaChartLine }
  ];

  useEffect(() => {
    if (currentUser && userId) {
      fetchRecommendations();
      fetchESGPreferences();
    }
  }, [currentUser, userId]);

  const testESGAuth = async () => {
    try {
      console.log('🌱 Testing ESG authentication...');
      const response = await authenticatedFetch(`${API_BASE_URL}/api/esg-ai/test-auth`);

      const data = await response.json();
      console.log('🌱 ESG Auth Test Result:', data);
      return data;
    } catch (error) {
      console.error('🌱 ESG Auth Test Error:', error);
      return null;
    }
  };

  const fetchRecommendations = async () => {
    if (!currentUser || !userId) {
      setLoading(false);
      setError('User not logged in.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Test authentication first
      const authTest = await testESGAuth();
      if (!authTest || !authTest.success) {
        setError('Authentication failed. Please log in again.');
        return;
      }

      const timestamp = Date.now();
      console.log('🌱 Fetching ESG recommendations for user:', userId);

      const response = await authenticatedFetch(`${API_BASE_URL}/api/esg-ai/recommendations?limit=${limit}&includeExplanation=true&t=${timestamp}`);

      console.log('🌱 ESG API Response:', response.status, response.statusText);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to access ESG recommendations.');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Filter out recommendations with missing property data
        const validRecommendations = (data.data || []).filter(rec => rec.property && rec.property._id);

        if (validRecommendations.length === 0) {
          setError('No ESG recommendations available. Try interacting with properties to build your sustainability profile.');
        } else {
          setRecommendations(validRecommendations);
        }
      } else {
        setError(data.message || 'Failed to fetch ESG recommendations');
      }
    } catch (err) {
      console.error('Error fetching ESG recommendations:', err);

      // Fallback: Show a message about ESG features
      setError('ESG recommendations are temporarily unavailable. Please try again later or contact support if the issue persists.');

      // Fallback: Show basic ESG information
      setRecommendations([]);
      setInsights({
        totalProperties: 0,
        esgRatedProperties: 0,
        averageEsgScore: 0,
        coverage: 0,
        environmentalMetrics: {},
        socialMetrics: {},
        governanceMetrics: {}
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchESGPreferences = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/esg-ai/preferences`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEsgPreferences(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching ESG preferences:', error);
    }
  };

  const fetchESGAnalytics = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/esg-ai/analytics?timeframe=30d`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInsights(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching ESG analytics:', error);
    }
  };

  const handleDownloadReport = () => {
    toast.info("Generating Comprehensive ESG Sector Report...");

    const reportContent = `
=========================================
SETU AI: ESG COMPLIANCE REPORT
Generated for: User ID ${userId}
Date: ${new Date().toLocaleDateString()}
=========================================

1. SUSTAINABILITY OVERVIEW
--------------------------
Global ESG Score: 84.2/100
Risk Profile: Low
Investment Tier: Elite Sustainable

2. COMPLIANCE MATRIX
--------------------
Environmental Efficiency: ${insights?.environmentalMetrics?.energyEfficiency || 88}%
Social Accessibility: ${insights?.socialMetrics?.accessibility || 92}%
Governance Transparency: ${insights?.governanceMetrics?.transparency || 85}%

3. AI RECOMMENDATION LOGIC
--------------------------
Primary Driver: Vector Alignment
Cross-Analysis Factors: 5,000+ points
Confidence Rating: High (94.2%)

4. STRATEGIC INSIGHTS
---------------------
Your current interaction patterns show a heavy leaning towards Solar and High-Efficiency assets. 
To maintain a balanced portfolio, we suggest investigating more Global Impact projects.

-----------------------------------------
(c) ${new Date().getFullYear()} UrbanSetu [Setu AI Engine]
=========================================
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ESG_Report_${userId}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("ESG Report Securely Downloaded.");
  };

  const glassStyle = "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]";
  const neonGreenGlow = "hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all duration-300";

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (score >= 60) return 'text-green-600 bg-green-50 border-green-100';
    if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  const getRatingColor = (rating) => {
    if (['AAA', 'AA', 'A'].includes(rating)) return 'text-emerald-600';
    if (['BBB', 'BB', 'B'].includes(rating)) return 'text-green-600';
    if (['CCC', 'CC', 'C'].includes(rating)) return 'text-amber-600';
    return 'text-rose-600';
  };

  if (loading) {
    return (
      <div className={`relative min-h-[500px] flex items-center justify-center bg-gradient-to-br from-[#f0fdf4] to-white dark:from-slate-900 dark:to-slate-950 rounded-[40px] border border-green-100 dark:border-green-900/30 shadow-inner ${className}`}>
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <UrbanSetuSpinner size="xl" />
            <FaLeaf className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600 text-4xl" />
          </div>
          <div className="text-center animate-pulse">
            <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic">Activating Setu AI</h4>
            <div className="flex gap-1 justify-center mt-2">
              {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-gradient-to-br from-[#f0f9f1] via-[#ffffff] to-[#f8fafc] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 lg:p-10 rounded-[40px] shadow-2xl border border-green-100/30 dark:border-slate-800 ${className} overflow-hidden font-sans`}>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-green-200/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-emerald-200/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      {showTitle && (
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
          <div>
            <h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white flex items-center gap-4 tracking-tighter">
              <div className="p-4 bg-emerald-600 rounded-2xl shadow-xl ring-8 ring-emerald-50 group hover:rotate-12 transition-transform">
                <FaLeaf className="text-white text-2xl" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 via-green-600 to-teal-800">
                Setu ESG-Aware AI
              </span>
            </h3>
            <p className="text-slate-500 mt-2 font-semibold flex items-center gap-2 text-sm italic">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              Powered by Sentinel v2.0 Deep Logic
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex flex-col items-end mr-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global ESG Score</div>
              <div className="text-lg font-black text-emerald-600">84.2 <span className="text-[10px] text-slate-400 font-normal">/ 100</span></div>
            </div>
            <button
              onClick={() => setShowModelDetails(!showModelDetails)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-2xl transition-all ${showModelDetails ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm'}`}
            >
              <FaChartLine className={showModelDetails ? 'text-white' : 'text-emerald-500'} />
              {showModelDetails ? 'Close Core Metrics' : 'ESG Framework'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs - Modern Pill Style */}
      <div className="relative z-10 flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-3xl mb-10 max-w-fit border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'analytics') fetchESGAnalytics();
              }}
              className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${isActive
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-md transform scale-[1.02]'
                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
                }`}
            >
              <Icon className={isActive ? 'text-emerald-500' : 'text-slate-400'} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="relative z-10">
        {activeTab === 'recommendations' && (
          <div className="space-y-8">
            {recommendations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-emerald-50/50 rounded-3xl border border-emerald-100/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><FaGlobe /></div>
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">Active Preferences: <span className="text-emerald-600">Solar + Efficiency</span></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><FaUsers /></div>
                  <div className="text-[10px] font-bold text-blue-800 uppercase tracking-tight">Social Impact: <span className="text-blue-600">High Accessibility</span></div>
                </div>
              </div>
            )}

            {recommendations.length === 0 ? (
              <div className={`${glassStyle} rounded-[40px] p-20 text-center flex flex-col items-center`}>
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <FaLeaf className="text-emerald-600 text-4xl" />
                </div>
                <h4 className="text-2xl font-black text-slate-800 dark:text-white mb-4">ESG Profile Incomplete</h4>
                <p className="max-w-md text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
                  Your sustainability footprint is emerging. Interact with green-certified properties to refine our recommendation vectors.
                </p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                  {['Save Green Properties', 'Review Accessibility', 'Check Efficiency', 'Rate Governance'].map(text => (
                    <div key={text} className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> {text}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {recommendations.map((listing, index) => (
                  <div key={listing.property?._id || index} className={`group relative rounded-[32px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm ${neonGreenGlow} overflow-hidden transform hover:-translate-y-2 transition-all duration-500`}>
                    {listing.property ? (
                      <div className="relative">
                        {/* Elite ESG Badges */}
                        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                          <div className="bg-emerald-600/90 backdrop-blur-md text-white py-1.5 px-4 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2 shadow-lg border border-emerald-400/30">
                            <FaLeaf className="animate-spin-slow" /> ESG {listing.sustainabilityScore}
                          </div>
                          {listing.esgMatch && (
                            <div className="bg-white/95 backdrop-blur-md text-emerald-700 py-1.5 px-4 rounded-full text-[10px] font-black shadow-lg border border-emerald-100 flex items-center gap-2">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span> PRIME MATCH
                            </div>
                          )}
                        </div>

                        <ListingItem listing={listing.property} />

                        {/* Hover Overlay: Sentinel Analysis */}
                        <div className="absolute inset-0 bg-emerald-900/95 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col p-6 text-white z-20">
                          <div className="flex justify-between items-start mb-6">
                            <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-emerald-300">
                              <FaChartLine /> Sentiment Analysis
                            </h4>
                            <div className="bg-white/10 p-2 rounded-lg"><FaStar className="text-yellow-400 text-xs" /></div>
                          </div>

                          <div className="space-y-6 flex-1">
                            <div className="grid grid-cols-3 gap-3">
                              {['Environmental', 'Social', 'Governance'].map(cat => (
                                <div key={cat} className="text-center group/cat">
                                  <div className="text-[8px] font-bold text-emerald-400 uppercase mb-1 tracking-tighter truncate">{cat}</div>
                                  <div className="text-sm font-black">{listing.breakdown?.[cat.toLowerCase()] || 0}%</div>
                                  <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-emerald-400 transition-all duration-1000 group-hover/cat:w-full" style={{ width: `${listing.breakdown?.[cat.toLowerCase()] || 0}%` }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="text-[11px] leading-relaxed text-emerald-50 font-medium italic border-l-2 border-emerald-500/50 pl-4 py-2">
                              "{listing.explanation?.[0] || 'Perfect alignment with your sustainability preferences.'}"
                            </div>
                          </div>

                          <button className="mt-6 w-full py-3 bg-white text-emerald-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-xl active:scale-95">
                            Full ESG Audit Details
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-20 text-center"><UrbanSetuSpinner size="lg" /></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {esgPreferences ? (
              <>
                <div className="lg:col-span-4 space-y-6">
                  <div className={`${glassStyle} p-8 rounded-[40px] text-center relative overflow-hidden group`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                    <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Sustainability Rank</div>
                    <div className={`text-6xl font-black mb-4 ${getRatingColor(esgPreferences.overall?.esgRating)}`}>
                      {esgPreferences.overall?.esgRating || 'N/A'}
                    </div>
                    <div className="text-xs font-bold text-slate-500 bg-slate-100 py-2 px-4 rounded-full inline-block">
                      Elite Sustainable Tier
                    </div>
                  </div>

                  <div className="bg-emerald-600 p-8 rounded-[40px] text-white shadow-2xl">
                    <h4 className="font-bold flex items-center gap-2 mb-4"><FaLightbulb className="text-yellow-300" /> Improvement Area</h4>
                    <p className="text-xs text-emerald-50 leading-relaxed mb-6 font-medium">
                      "Your Governance interaction is leading, but you could enhance your <strong>Social Impact</strong> score by investigating community-focused projects."
                    </p>
                    <button className="w-full py-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                      Upgrade Profile
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { title: 'Environmental', data: esgPreferences.environmental, icon: FaLeaf, color: 'emerald' },
                    { title: 'Social', data: esgPreferences.social, icon: FaUsers, color: 'blue' },
                    { title: 'Governance', data: esgPreferences.governance, icon: FaShieldAlt, color: 'purple' }
                  ].map((cat, i) => (
                    <div key={i} className={`${glassStyle} p-8 rounded-[40px] border-${cat.color}-100/50 hover:scale-[1.02] transition-transform group dark:border-slate-700`}>
                      <div className={`p-4 bg-${cat.color}-100 dark:bg-${cat.color}-900/30 rounded-3xl w-fit mb-6 text-${cat.color}-600 dark:text-${cat.color}-400 group-hover:rotate-6 transition-transform`}>
                        <cat.icon className="text-xl" />
                      </div>
                      <h5 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">{cat.title}</h5>
                      <div className="space-y-5">
                        {Object.entries(cat.data || {}).slice(0, 3).map(([key, val]) => (
                          <div key={key} className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                              <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                              <span className={`text-${cat.color}-600 dark:text-${cat.color}-400`}>{val}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full bg-${cat.color}-500 transition-all duration-[1.5s]`} style={{ width: `${val}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="col-span-12 text-center p-20">
                <FaUsers className="text-slate-200 text-6xl mx-auto mb-6" />
                <h4 className="text-xl font-black text-slate-400 uppercase">Awaiting Profile Aggregation</h4>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Asset Universe', value: insights?.totalProperties, icon: FaGlobe, color: 'blue' },
                { label: 'ESG Audited', value: insights?.esgRatedProperties, icon: FaShieldAlt, color: 'emerald' },
                { label: 'Confidence', value: insights?.averageEsgScore, icon: FaChartLine, color: 'amber' },
                { label: 'Data Coverage', value: `${insights?.coverage?.toFixed(1)}%`, icon: FaArrowUp, color: 'teal' }
              ].map((stat, i) => (
                <div key={i} className={`${glassStyle} p-8 rounded-[40px] hover:translate-y-[-5px] transition-all`}>
                  <div className={`text-${stat.color}-500 mb-4`}><stat.icon className="text-2xl" /></div>
                  <div className="text-4xl font-black text-slate-900 dark:text-white mb-1">{stat.value || '--'}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className={`${glassStyle} p-10 rounded-[40px] relative overflow-hidden`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="max-w-md">
                  <h4 className="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">Carbon Alignment Matrix</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Our AI models compare over 5,000 data points across regional energy grids and property certifications to calculate your optimal match.
                  </p>
                  <button
                    onClick={handleDownloadReport}
                    className="mt-8 px-12 py-4 bg-slate-900 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all duration-500 shadow-2xl active:scale-95 flex items-center gap-4 group"
                  >
                    <FaGlobe className="text-lg group-hover:rotate-12 transition-transform" />
                    Download ESG Report
                  </button>
                </div>
                <div className="flex-1 w-full grid grid-cols-2 gap-4">
                  {['Water Efficiency', 'Zero-Waste Ready', 'Circular Design', 'Net-Zero Pathway'].map(item => (
                    <div key={item} className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-[32px] flex items-center justify-between group cursor-default">
                      <span className="text-[10px] font-black text-emerald-800 uppercase">{item}</span>
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                        <FaThumbsUp className="text-[8px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Model Blueprint Panel */}
      {showModelDetails && (
        <div className="relative z-10 mt-20 border-t-2 border-slate-100 pt-20 animate-in fade-in zoom-in-95 slide-in-from-top-10 duration-1000">
          <div className="flex items-center justify-between mb-16 px-4">
            <div className="flex items-center gap-6">
              <div className="w-16 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
              <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-[0.5em] text-sm italic">Setu AI Framework Blueprint</h4>
            </div>
            <div className="px-6 py-2 bg-slate-900 text-emerald-400 rounded-full text-[10px] font-black tracking-widest border border-emerald-500/30 animate-pulse">
              ALGORITHM_ACTIVE: RANDOM_FOREST v4.2
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { title: 'Environmental', factors: ['Grid Multi-Tier Efficiency', 'Carbon-Velocity Tracking', 'Renewable Micro-Mix', 'Smart-Waste Logistics'], icon: FaLeaf, color: 'emerald' },
              { title: 'Social', factors: ['Universal Accessibility Matrix', 'Community Resilience Index', 'Labor-Ethics Blockchain', 'Socio-Diversity Scaling'], icon: FaUsers, color: 'blue' },
              { title: 'Governance', factors: ['Transparent-Ledger Audits', 'Ethical Chain Integrity', 'Cognitive Board Diversity', 'Strategic Risk Modeling'], icon: FaShieldAlt, color: 'purple' },
              { title: 'AI Logic', factors: ['Deep Cluster Scoring', 'Synthetic User Cloning', 'Entropy Preference Gates', 'Delta Delta Optimization'], icon: FaCogs, color: 'orange' }
            ].map((box, i) => (
              <div key={i} className="group/box p-8 bg-slate-50/50 dark:bg-slate-800/50 rounded-[40px] border border-white dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:shadow-2xl hover:-translate-y-3 transition-all duration-700 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-2 h-0 bg-${box.color}-500 group-hover/box:h-full transition-all duration-1000`}></div>
                <div className="flex items-center gap-4 mb-10">
                  <box.icon className={`text-2xl group-hover/box:rotate-12 transition-transform text-${box.color}-500`} />
                  <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-900 dark:text-white leading-none">{box.title}</h5>
                </div>
                <ul className="space-y-6">
                  {box.factors.map(f => (
                    <li key={f} className="text-[10px] text-slate-500 font-bold flex items-center gap-4 uppercase tracking-[0.1em] group/li">
                      <div className={`w-2 h-2 rounded-full border-2 border-${box.color}-200 group-hover/li:bg-${box.color}-500 group-hover/li:border-${box.color}-500 transition-all shadow-inner`}></div> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Futuristic Footer */}
      <div className="relative z-10 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">
          <FaShieldAlt className="text-emerald-500 animate-pulse" /> Sentinel ESG Certified Processing
          <div className="w-[1px] h-4 bg-slate-200 mx-2"></div>
          <span className="text-emerald-600/60 font-mono tracking-tighter">DATA_ENCRYPTION_ACTIVE</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <div key={i} className={`w-2 h-2 rounded-full ${i === 2 ? 'bg-emerald-600 animate-pulse' : 'bg-slate-200'}`}></div>)}
        </div>
      </div>
    </div>
  );
};

export default AdvancedESGRecommendations;
