import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { FaChartLine, FaArrowUp, FaCalculator, FaHome, FaBuilding, FaPercentage, FaClock, FaMapMarkerAlt, FaStar, FaInfoCircle, FaShieldAlt, FaGraduationCap, FaBus, FaCloud, FaArrowDown, FaExclamationTriangle, FaCheckCircle, FaTimes } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';

import { authenticatedFetch } from '../utils/auth';

const EnhancedSmartPriceInsights = ({ listing, currentUser }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (listing && currentUser) {
      fetchAnalyticsData();
    }
  }, [listing, currentUser]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/analytics/property/${listing._id}/analytics`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const data = await response.json();
      setAnalyticsData(data.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-blue-100';
    if (score >= 40) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getRecommendationColor = (recommendation) => {
    if (recommendation.includes('Excellent')) return 'text-green-600';
    if (recommendation.includes('Good')) return 'text-blue-600';
    if (recommendation.includes('Fair')) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
        <div className="flex flex-col items-center justify-center py-12">
          <UrbanSetuSpinner size="xl" />
          <div className="mt-6 text-center">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white animate-pulse">Analyzing Real-Time Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400">Fetching latest market data and insights...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
        <div className="flex items-center justify-center py-12">
          <FaTimes className="text-4xl text-red-500 mr-4" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Failed to Load Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={fetchAnalyticsData}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return null;
  }

  const { marketData, locationData, weatherData, trendsData, investmentAnalysis } = analyticsData;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg">
          <FaChartLine className="text-white text-xl" />
        </div>
        <div>
          <h4 className="text-2xl font-bold text-gray-800 dark:text-white">Real-Time Property Analytics</h4>
          <p className="text-gray-600 dark:text-gray-400">Live market data and AI-powered insights</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">Last updated: {new Date(analyticsData.lastUpdated).toLocaleString()}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: FaChartLine },
          { id: 'investment', label: 'Investment', icon: FaCalculator },
          { id: 'location', label: 'Location', icon: FaMapMarkerAlt },
          { id: 'market', label: 'Market Trends', icon: FaArrowUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm whitespace-normal ${activeTab === tab.id
              ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
              }`}
          >
            <tab.icon className="text-sm" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50">
              <div className="flex items-center gap-2 mb-2">
                <FaStar className="text-blue-600 dark:text-blue-400" />
                <h6 className="font-semibold text-blue-800 dark:text-blue-200">Investment Score</h6>
              </div>
              <p className={`text-2xl font-bold ${getScoreColor(investmentAnalysis?.investmentScore || 0)}`}>
                {investmentAnalysis?.investmentScore || 0}/100
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {investmentAnalysis?.recommendation || 'Loading...'}
              </p>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/20 p-4 rounded-lg border border-green-100 dark:border-green-800/50">
              <div className="flex items-center gap-2 mb-2">
                <FaPercentage className="text-green-600 dark:text-green-400" />
                <h6 className="font-semibold text-green-800 dark:text-green-200">ROI Potential</h6>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {investmentAnalysis?.roi?.annual || 0}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Annual return</p>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/20 p-4 rounded-lg border border-orange-100 dark:border-orange-800/50">
              <div className="flex items-center gap-2 mb-2">
                <FaArrowUp className="text-orange-600 dark:text-orange-400" />
                <h6 className="font-semibold text-orange-800 dark:text-orange-200">Appreciation</h6>
              </div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {investmentAnalysis?.appreciation?.annual || 0}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Annual growth</p>
            </div>

            {(currentUser?.role === 'admin' || currentUser?.role === 'rootadmin') && (
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <FaShieldAlt className="text-purple-600 dark:text-purple-400" />
                  <h6 className="font-semibold text-purple-800 dark:text-purple-200">Risk Level</h6>
                </div>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {investmentAnalysis?.riskScore || 0}/100
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Lower is better</p>
              </div>
            )}
          </div>

          {/* Market Comparison */}
          {marketData && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:to-indigo-800/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <h5 className="text-lg font-semibold text-indigo-800 dark:text-indigo-200 mb-4 flex items-center gap-2">
                <FaBuilding className="text-indigo-600 dark:text-indigo-400" />
                Market Comparison
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Property Price</p>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {formatINR(listing.offer ? listing.discountPrice : listing.regularPrice)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Market Average</p>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {formatINR(marketData.averagePrice || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Price vs Market</p>
                  <p className={`text-xl font-bold ${(listing.offer ? listing.discountPrice : listing.regularPrice) < (marketData.averagePrice || 0)
                    ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                    {marketData.averagePrice ?
                      `${(((listing.offer ? listing.discountPrice : listing.regularPrice) - marketData.averagePrice) / marketData.averagePrice * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Investment Tab */}
      {activeTab === 'investment' && investmentAnalysis && (
        <div className="space-y-6">
          {/* Investment Timeline */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/20 p-6 rounded-xl border border-green-100 dark:border-green-800/50">
            <h5 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4 flex items-center gap-2">
              <FaCalculator className="text-green-600 dark:text-green-400" />
              Investment Timeline
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(investmentAnalysis.timeline || {}).map(([period, data]) => (
                <div key={period} className="bg-white dark:bg-gray-700 p-4 rounded-lg">
                  <h6 className="font-semibold text-gray-800 dark:text-gray-200 capitalize mb-2">{period} Outlook</h6>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">ROI:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{data.roi?.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Appreciation:</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{data.appreciation?.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 dark:border-gray-600 pt-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Total Return:</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">{data.totalReturn?.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Analysis - admins only */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'rootadmin') && (
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-800/20 p-6 rounded-xl border border-red-100 dark:border-red-800/50">
              <h5 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
                <FaExclamationTriangle className="text-red-600 dark:text-red-400" />
                Risk Analysis
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Overall Risk Score</span>
                    <span className={`font-bold ${getScoreColor(100 - investmentAnalysis.riskScore)}`}>
                      {investmentAnalysis.riskScore}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreBg(100 - investmentAnalysis.riskScore)}`}
                      style={{ width: `${100 - investmentAnalysis.riskScore}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Risk Level:
                    <span className={`ml-2 font-semibold ${investmentAnalysis.riskScore < 30 ? 'text-green-600 dark:text-green-400' :
                      investmentAnalysis.riskScore < 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                      {investmentAnalysis.riskScore < 30 ? 'Low' :
                        investmentAnalysis.riskScore < 60 ? 'Medium' : 'High'}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Recommendation:
                    <span className={`ml-2 font-semibold ${getRecommendationColor(investmentAnalysis.recommendation)}`}>
                      {investmentAnalysis.recommendation}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Location Tab */}
      {activeTab === 'location' && locationData && (
        <div className="space-y-6">
          {/* Location Score */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800/50">
            <h5 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
              <FaMapMarkerAlt className="text-blue-600 dark:text-blue-400" />
              Location Intelligence
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Location Score</span>
                  <span className={`font-bold ${getScoreColor(locationData.locationScore)}`}>
                    {locationData.locationScore}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${getScoreBg(locationData.locationScore)}`}
                    style={{ width: `${locationData.locationScore}%` }}
                  ></div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">Safety:
                  <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                    {locationData.crimeData?.safetyScore || 0}/100
                  </span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Schools:
                  <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                    {locationData.schoolData?.totalSchools || 0} nearby
                  </span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Transport:
                  <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">
                    {locationData.transportData?.totalStations || 0} stations
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Amenities */}
          {locationData.amenities && (
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/20 p-6 rounded-xl border border-green-100 dark:border-green-800/50">
              <h5 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4 flex items-center gap-2">
                <FaHome className="text-green-600 dark:text-green-400" />
                Nearby Amenities
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['restaurant', 'hospital', 'school', 'shopping_mall', 'park', 'gym', 'pharmacy', 'bank', 'gas_station', 'airport'].map((type) => {
                  const places = (locationData.amenities && locationData.amenities[type]) || [];
                  return (
                    <div key={type} className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <h6 className="font-semibold text-gray-800 dark:text-gray-200 capitalize mb-2">{type.replace('_', ' ')}</h6>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{places.length}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">within 2km</p>
                    </div>
                  );
                })}
                {/* Transit stations (from transportData) */}
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                  <h6 className="font-semibold text-gray-800 dark:text-gray-200 capitalize mb-2">transit stations</h6>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{locationData.transportData?.totalStations || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">within 2km</p>
                </div>
              </div>
            </div>
          )}

          {/* Weather */}
          {weatherData && (
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/40 dark:to-cyan-800/20 p-6 rounded-xl border border-cyan-100 dark:border-cyan-800/50">
              <h5 className="text-lg font-semibold text-cyan-800 dark:text-cyan-200 mb-4 flex items-center gap-2">
                <FaCloud className="text-cyan-600 dark:text-cyan-400" />
                Current Weather
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Temperature</p>
                  <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{weatherData.temperature}°C</p>
                </div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Humidity</p>
                  <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{weatherData.humidity}%</p>
                </div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Wind Speed</p>
                  <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{weatherData.windSpeed} km/h</p>
                </div>
                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Condition</p>
                  <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 capitalize">{weatherData.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Market Trends Tab */}
      {activeTab === 'market' && trendsData && (
        <div className="space-y-6">
          {/* Price Trends Chart */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/20 p-6 rounded-xl border border-purple-100 dark:border-purple-800/50">
            <h5 className="text-base md:text-lg font-semibold text-purple-800 dark:text-purple-200 mb-4 flex items-center gap-2 break-words">
              <FaArrowUp className="text-purple-600 dark:text-purple-400" />
              Market Trends
            </h5>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={Object.entries(trendsData.monthlyData || {}).map(([month, data]) => ({
                  month,
                  averagePrice: data.averagePrice,
                  minPrice: data.minPrice,
                  maxPrice: data.maxPrice
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`} />
                  <Tooltip
                    formatter={(value, name) => [formatINR(value), name === 'averagePrice' ? 'Average Price' : name === 'minPrice' ? 'Min Price' : 'Max Price']}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Line type="monotone" dataKey="averagePrice" stroke="#8b5cf6" strokeWidth={3} />
                  <Line type="monotone" dataKey="minPrice" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="maxPrice" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Market Sentiment */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/20 p-6 rounded-xl border border-orange-100 dark:border-orange-800/50">
            <h5 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-4 flex items-center gap-2">
              <FaArrowUp className="text-orange-600 dark:text-orange-400" />
              Market Sentiment
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">Price Growth</p>
                <p className={`text-2xl font-bold ${trendsData.priceGrowth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trendsData.priceGrowth > 0 ? '+' : ''}{trendsData.priceGrowth?.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">6 months</p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">Market Sentiment</p>
                <p className={`text-2xl font-bold ${trendsData.marketSentiment === 'Bullish' ? 'text-green-600 dark:text-green-400' :
                  trendsData.marketSentiment === 'Bearish' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                  {trendsData.marketSentiment || 'Neutral'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Current trend</p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">Market Activity</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {marketData?.marketActivity || 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Similar properties</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedSmartPriceInsights;
