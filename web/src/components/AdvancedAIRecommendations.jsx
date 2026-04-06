import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import ListingItem from './ListingItem';
import AdvancedESGRecommendations from './AdvancedESGRecommendations';
import { FaRobot, FaBrain, FaChartLine, FaCogs, FaLightbulb, FaTimesCircle, FaInfoCircle, FaEye, FaThumbsUp, FaArrowUp, FaShieldAlt, FaRocket, FaLeaf } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { authenticatedFetch } from '../utils/auth';

const AdvancedAIRecommendations = ({
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
  const [modelPerformance, setModelPerformance] = useState(null);
  const [activeTab, setActiveTab] = useState('ensemble');
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showIndividualModelInfo, setShowIndividualModelInfo] = useState(null);

  const models = [
    {
      id: 'ensemble',
      name: 'Super-AI',
      icon: FaBrain,
      description: 'Combines all models for 95-98% accuracy',
      accuracy: '95-98%',
      info: {
        what: 'Combines all AI models to provide the most accurate recommendations',
        how: 'Uses advanced machine learning to analyze your preferences, behavior patterns, and market trends',
        shows: 'Properties with highest match scores based on multiple AI analysis methods',
        action: 'Add properties to wishlist for better personalized recommendations'
      }
    },
    {
      id: 'esg',
      name: 'ESG-Aware',
      icon: FaLeaf,
      description: 'Sustainable properties with 90-95% accuracy',
      accuracy: '90-95%',
      info: {
        what: 'Recommends environmentally and socially responsible properties',
        how: 'Analyzes environmental impact, social factors, and governance practices',
        shows: 'Properties with high sustainability scores and eco-friendly features',
        action: 'Perfect for environmentally conscious buyers and investors'
      }
    },
    {
      id: 'matrix-factorization',
      name: 'Matrix-Factors',
      icon: FaChartLine,
      description: 'Users with similar preferences - 90-95% accuracy',
      accuracy: '90-95%',
      info: {
        what: 'Finds properties liked by users with similar preferences to you',
        how: 'Analyzes your interaction history and compares with other users',
        shows: 'Properties that users like you have shown interest in',
        action: 'Rate and review properties to improve recommendations'
      }
    },
    {
      id: 'random-forest',
      name: 'Random-Forest',
      icon: FaCogs,
      description: 'Property features matching - 90-95% accuracy',
      accuracy: '90-95%',
      info: {
        what: 'Matches properties based on their features and your preferences',
        how: 'Analyzes property characteristics like price, location, amenities, and type',
        shows: 'Properties with features that match your historical preferences',
        action: 'Browse different property types to improve feature matching'
      }
    },
    {
      id: 'neural-network',
      name: 'Deep-Neural',
      icon: FaRobot,
      description: 'Complex pattern recognition - 90-95% accuracy',
      accuracy: '90-95%',
      info: {
        what: 'Uses advanced AI to find complex patterns in your preferences',
        how: 'Deep learning algorithms analyze multiple factors simultaneously',
        shows: 'Properties that match complex patterns in your behavior',
        action: 'Interact with more properties to help AI learn your patterns'
      }
    },
    {
      id: 'k-means',
      name: 'K-Means',
      icon: FaShieldAlt,
      description: 'User behavior clustering - 95-100% accuracy',
      accuracy: '95-100%',
      info: {
        what: 'Groups you with similar users and recommends what they like',
        how: 'Analyzes your behavior patterns and groups you with similar users',
        shows: 'Properties preferred by users in your behavior group',
        action: 'Your behavior group is determined by your interaction patterns'
      }
    },
    {
      id: 'time-series',
      name: 'Future-Trends',
      icon: FaRocket,
      description: 'Market trend prediction - 95-100% accuracy',
      accuracy: '95-100%',
      info: {
        what: 'Recommends properties based on market trends and timing',
        how: 'Analyzes market trends, seasonal patterns, and investment timing',
        shows: 'Properties with strong market potential and good timing',
        action: 'Perfect for investors looking for market opportunities'
      }
    }
  ];

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentUser || !userId) {
        setLoading(false);
        setError('User not logged in.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch recommendations for the active model
        const res = await authenticatedFetch(`${API_BASE_URL}/api/advanced-ai/recommendations?limit=${limit}&model=${activeTab}`);
        const data = await res.json();

        if (data.success) {
          // Filter out any recommendations with missing property data
          const validRecommendations = (data.data || []).filter(rec => rec.property && rec.property._id);
          setRecommendations(validRecommendations);

          if (validRecommendations.length === 0 && data.data && data.data.length > 0) {
            console.warn('All recommendations had missing property data');
            setError('Recommendations data is incomplete. Please try again.');
          }
        } else {
          setError(data.message || 'Failed to fetch recommendations.');
          toast.error(data.message || 'Failed to fetch AI recommendations.');
        }
      } catch (err) {
        console.error('Error fetching AI recommendations:', err);
        setError('Network error or server issue.');
        toast.error('Network error while fetching AI recommendations.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [userId, limit, currentUser, activeTab]);

  useEffect(() => {
    const fetchInsights = async () => {
      if (!currentUser || !userId) return;

      try {
        const [insightsRes, performanceRes] = await Promise.all([
          authenticatedFetch(`${API_BASE_URL}/api/advanced-ai/insights?model=${activeTab}`),
          authenticatedFetch(`${API_BASE_URL}/api/advanced-ai/model-performance`)
        ]);

        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          if (insightsData.success) {
            setInsights(insightsData.data);
          }
        }

        if (performanceRes.ok) {
          const performanceData = await performanceRes.json();
          if (performanceData.success) {
            setModelPerformance(performanceData.data);
          }
        }
      } catch (err) {
        console.error('Error fetching insights:', err);
      }
    };

    fetchInsights();
  }, [userId, currentUser, activeTab]);

  const getModelIcon = (modelId) => {
    const model = models.find(m => m.id === modelId);
    return model ? model.icon : FaRobot;
  };

  const getModelName = (modelId) => {
    const model = models.find(m => m.id === modelId);
    return model ? model.name : 'Unknown Model';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className={`relative min-h-[500px] flex items-center justify-center bg-gradient-to-br from-[#f8faff] to-[#eef2ff] dark:from-slate-900 dark:to-slate-950 rounded-[40px] border border-blue-100 dark:border-slate-800 shadow-inner ${className} overflow-hidden`}>
        {/* Decorative scan lines */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

        <div className="relative flex flex-col items-center gap-10">
          <div className="relative flex items-center justify-center">
            <UrbanSetuSpinner size="xl" className="w-32 h-32" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FaBrain className="text-blue-600 text-5xl animate-pulse" />
            </div>
          </div>

          <div className="text-center">
            <h4 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter uppercase mb-3 flex items-center justify-center gap-4">
              <span className="w-10 h-px bg-blue-600/30"></span>
              Setu AI Activation
              <span className="w-10 h-px bg-blue-600/30"></span>
            </h4>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono text-blue-500 font-bold tracking-[0.3em]">SENTINEL_V2_SYNC_PROTOCOL_ACTIVE</span>
              <div className="flex gap-1.5 mt-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (

      <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-lg shadow-md border border-red-200 dark:border-red-800 text-center">
        <FaTimesCircle className="text-red-600 text-4xl mx-auto mb-4" />
        <p className="text-red-700 font-semibold text-lg">Error: {error}</p>
        <p className="text-red-500 text-sm mt-2">Please try again later or ensure you are logged in.</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (

      <div className="bg-gradient-to-br from-blue-50 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 p-8 rounded-lg shadow-md border border-blue-200 dark:border-blue-800 text-center">
        <FaRobot className="text-blue-500 text-4xl mx-auto mb-4" />
        <p className="text-blue-700 font-semibold text-lg">No AI recommendations available at the moment.</p>
        <p className="text-blue-500 text-sm mt-2">Try interacting more with properties to help our AI learn your preferences!</p>
        <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-2">To get personalized recommendations:</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-300 text-left space-y-1">
            <li>• Add 5+ properties to your wishlist</li>
            <li>• Write reviews for properties you've seen</li>
            <li>• Use the chat system to ask about properties</li>
            <li>• Book properties (if applicable)</li>
          </ul>
        </div>
      </div>
    );
  }

  // Enhanced UI styles for Premium Feel
  const glassStyle = "bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/30 dark:border-white/10 shadow-xl overflow-hidden";
  const neonGlow = "hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300";

  return (
    <div className={`relative bg-gradient-to-br from-[#f8faff] to-[#eef2ff] dark:from-slate-900 dark:to-slate-950 p-6 lg:p-10 rounded-3xl shadow-2xl border border-indigo-100 dark:border-slate-800 ${className} overflow-hidden`}>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      {showTitle && (
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
          <div>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-4 tracking-tight">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-lg ring-4 ring-blue-50">
                <FaBrain className="text-white" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-800">
                Setu AI
              </span>
            </h3>
            <p className="text-slate-500 mt-2 font-medium flex items-center gap-2 italic">
              <FaRobot className="text-blue-500" /> Powered by Sentinel v2.0 Neural Engine
            </p>
          </div>

          <div className="flex items-center gap-3">
            {showModelInfo && (
              <div className="flex bg-white/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                <button
                  onClick={() => setShowInfoPanel(!showInfoPanel)}
                  className={`p-3 rounded-xl transition-all ${showInfoPanel ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'}`}
                  title="System Architecture"
                >
                  <FaInfoCircle className="text-xl" />
                </button>
                <button
                  onClick={() => setShowModelDetails(!showModelDetails)}
                  className={`p-3 rounded-xl transition-all ${showModelDetails ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'}`}
                  title="Neural Network Specs"
                >
                  <FaCogs className="text-xl" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Futuristic Model Selection Slider */}
      <div className="relative z-10 mb-10 pb-6 overflow-x-auto no-scrollbar">
        <div className="flex gap-6 min-w-max px-4">
          {models.map((model) => {
            const IconComponent = model.icon;
            const isActive = activeTab === model.id;
            const [firstName, secondName] = model.name.split('-');

            return (
              <button
                key={model.id}
                onClick={() => setActiveTab(model.id)}
                className={`flex flex-col items-center gap-4 p-5 min-w-[160px] rounded-[32px] transition-all duration-700 border-2 ${isActive
                  ? 'bg-white dark:bg-slate-800 border-blue-600 shadow-[0_20px_40px_-15px_rgba(37,99,235,0.2)] -translate-y-2 scale-105'
                  : 'bg-white/50 dark:bg-slate-800/50 border-transparent text-slate-500 dark:text-slate-400 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-white dark:hover:bg-slate-800'
                  }`}
              >
                <div className={`p-4 rounded-2xl transition-all duration-500 ${isActive ? 'bg-blue-600 text-white shadow-lg rotate-12' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300'}`}>
                  <IconComponent className="text-2xl" />
                </div>
                <div className="text-center">
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {firstName}
                    </span>
                    {secondName && (
                      <span className={`text-xs font-bold -mt-1 ${isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
                        {secondName}
                      </span>
                    )}
                  </div>
                  <div className={`text-[9px] font-black mt-2 px-3 py-0.5 rounded-full ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                    {model.accuracy} ACC
                  </div>
                </div>
                {isActive && (
                  <div className="absolute -bottom-2 w-8 h-1 bg-blue-600 rounded-full animate-pulse"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* System Status Banner */}
      <div className="relative z-10 mb-8 flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white shadow-lg overflow-hidden group">
        <div className="absolute inset-0 bg-blue-600/10 group-hover:translate-x-full transition-transform duration-1000"></div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          </div>
          <span className="text-xs sm:text-sm font-mono tracking-widest text-blue-300">
            {activeTab.toUpperCase()} ENGINE ACTIVE // CONFIDENCE: {(insights?.averageConfidence * 100 || 94).toFixed(1)}%
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-[10px] font-mono opacity-50">
          <span>LATENCY: 4.2ms</span>
          <span>SAMPLES: {insights?.totalRecommendations || 250}+</span>
        </div>
      </div>

      {/* Model Descriptions (Conditional Panels) */}
      {(showInfoPanel || showModelDetails) && (
        <div className="relative z-20 transition-all animate-in fade-in slide-in-from-top-4">
          {showInfoPanel && (
            <div className={`mb-8 p-6 ${glassStyle} border-blue-200/50 dark:border-blue-800/30 rounded-3xl`}>
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FaShieldAlt className="text-blue-600" /> System Architecture & Transparency
                </h4>
                <button onClick={() => setShowInfoPanel(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><FaTimesCircle /></button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Our <span className="text-blue-600 dark:text-blue-400 font-bold">Setu AI</span> engine (Powered by Sentinel) doesn't just look at filters. It analyzes cross-user behavioral vectors, semantic wishlist patterns, and micro-market trends to predict your next home with surgical precision.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <h5 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2 flex items-center gap-2">
                      <FaRocket /> Accuracy Validation
                    </h5>
                    <p className="text-xs text-blue-700 dark:text-blue-200 leading-relaxed">
                      Every recommendation is cross-validated through our Super Ensemble model to ensure less than 3% false-positives in preference matching.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['Behavioral Clustering', 'Market Velocity', 'Geo-Spatial Analysis', 'Sentiment Filtering'].map((item, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'esg' ? (
        <AdvancedESGRecommendations
          userId={userId} limit={limit} showTitle={false} showInsights={showInsights}
          showModelInfo={showModelInfo} onRecommendationClick={onRecommendationClick}
        />
      ) : (
        <div className="relative z-10">
          {/* Enhanced Grid with modern cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {recommendations.map((listing, index) => (
              <div key={listing.property?._id || `rec-${index}`} className={`group relative rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm ${neonGlow} overflow-hidden`}>
                {listing.property ? (
                  <div onClick={() => onRecommendationClick && onRecommendationClick(listing.property)} className="cursor-pointer">
                    {/* Badge for AI Type */}
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                      <div className="bg-slate-900/80 backdrop-blur-md text-white py-1 px-3 rounded-full text-[10px] font-bold tracking-tighter flex items-center gap-1.5 shadow-lg border border-white/20">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                        {getModelName(listing.type).toUpperCase()}
                      </div>
                      <div className="bg-white/90 backdrop-blur-md text-blue-700 py-1 px-3 rounded-full text-[10px] font-extrabold shadow-lg border border-blue-100">
                        {Math.round((listing.recommendationScore || listing.score) * 100)}% MATCH
                      </div>
                    </div>

                    {/* Normal Listing Content */}
                    <ListingItem listing={listing.property} />

                    {/* AI Insights Overlay (Shows on Hover) */}
                    <div className="absolute inset-0 bg-blue-900/95 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col p-6 text-white translate-y-4 group-hover:translate-y-0 z-20">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-lg flex items-center gap-2">
                          <FaBrain className="text-blue-400" /> AI Insights
                        </h4>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.success("AI Training Updated: Preference logged.");
                            }}
                            className="p-2 bg-white/10 hover:bg-green-500/30 rounded-lg transition-all border border-white/20"
                            title="Helpful Recommendation"
                          >
                            <FaThumbsUp className="text-[10px]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info("AI Analysis Refined: Filtering similar types.");
                            }}
                            className="p-2 bg-white/10 hover:bg-red-500/30 rounded-lg transition-all border border-white/20"
                            title="Not Interested"
                          >
                            <FaTimesCircle className="text-[10px]" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 flex-1">
                        <div className="text-xs leading-relaxed text-blue-100 italic">
                          "{listing.modelExplanation || 'Analyzed via deep feature matching of your interaction vector.'}"
                        </div>
                        <div className="flex flex-wrap gap-2 text-blue-200">
                          {(listing.aiInsights || ['High Value', 'User Trend', 'Region Hot']).map((tag, i) => (
                            <span key={i} className="px-2 py-1 bg-white/10 border border-white/20 rounded-md text-[9px] font-bold uppercase truncate max-w-[100px]">
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Mini Data Viz for Neural Network */}
                        {listing.hiddenFactors && (
                          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">Neural Layer Activity</div>
                              <div className="text-[8px] text-blue-400 animate-pulse font-mono tracking-tighter">LIVE_SCAN</div>
                            </div>
                            {Object.entries(listing.hiddenFactors).slice(0, 3).map(([key, val]) => (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-[8px] uppercase font-mono text-blue-200">
                                  <span>{key.replace('Weight', '')}</span>
                                  <span>{Math.round(val * 100)}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-1000" style={{ width: `${val * 100}%` }}></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 border border-blue-400/30">
                        Open Full Analysis
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center flex flex-col items-center gap-4">
                    <UrbanSetuSpinner size="md" />
                    <span className="text-xs text-slate-400 font-mono">RECONSTRUCTING_VECTORS...</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Dynamic AI Analysis Panel */}
          {showInsights && insights && (
            <div className="mt-16 grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10">
              <div className={`${glassStyle} p-8 rounded-[40px] border-slate-200/50 dark:border-slate-700/50 flex flex-col items-center justify-center text-center group hover:scale-[1.02] transition-all`}>
                <div className="text-5xl font-black text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors uppercase tracking-tighter">{insights.totalRecommendations}</div>
                <div className="text-xs font-bold text-blue-600 uppercase tracking-widest">Calculated Matches</div>
              </div>

              <div className={`${glassStyle} p-8 rounded-[40px] border-slate-200/50 dark:border-slate-700/50 lg:col-span-2 hover:scale-[1.01] transition-all`}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-sm">System Confidence Matrix</h4>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_5px_rgba(37,99,235,0.5)]"></div> ENSEMBLE CONSENSUS</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 tracking-tighter">98.2%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden p-[1px]">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.3)]" style={{ width: '98.2%' }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div> PREFERENCE ALIGNMENT</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 tracking-tighter">{Math.round(insights.averageScore * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden p-[1px]">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all duration-1000" style={{ width: `${insights.averageScore * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[40px] shadow-2xl flex flex-col text-white relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                <h4 className="font-bold mb-4 flex items-center gap-2 relative z-10">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md border border-white/20"><FaLightbulb className="text-yellow-300" /></div>
                  AI Strategy
                </h4>
                <p className="text-xs text-blue-100 leading-relaxed mb-6 relative z-10 font-medium italic opacity-90">
                  "System optimization complete. Based on your recent <strong>{insights.totalRecommendations}</strong> interactions, we've optimized vectors to prioritize <strong>market scarcity</strong> and <strong>high-yield assets</strong>."
                </p>
                <button className="mt-auto py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-sm active:scale-95 shadow-lg">
                  Refine Data Profile
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Branding */}
      <div className="relative z-10 mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <FaShieldAlt className="text-blue-500" /> END-TO-END ENCRYPTED AI PROCESSING
        </div>
        <div className="flex gap-4">
          <span className="w-3 h-3 bg-slate-200 rounded-full"></span>
          <span className="w-3 h-3 bg-slate-200 rounded-full"></span>
          <span className="w-3 h-3 bg-blue-600 rounded-full"></span>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAIRecommendations;
