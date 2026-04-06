import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FaLeaf, FaUsers, FaShieldAlt, FaChartLine, FaArrowUp, FaTrendingDown, FaStar, FaGlobe, FaRecycle, FaSolarPanel, FaWater, FaTrash, FaAccessibleIcon, FaHeart, FaBuilding, FaGavel, FaEye, FaInfoCircle } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';
import { authenticatedFetch } from '../utils/auth';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdminESGAnalytics() {
    usePageTitle("ESG Analytics - Admin Dashboard");

    const { currentUser } = useSelector((state) => state.user);
    const [esgAnalytics, setEsgAnalytics] = useState({
        totalProperties: 0,
        esgRatedProperties: 0,
        averageEsgScore: 0,
        environmentalMetrics: {},
        socialMetrics: {},
        governanceMetrics: {},
        topPerformers: [],
        improvementAreas: [],
        trends: {}
    });
    const [loading, setLoading] = useState(true);
    const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

    useEffect(() => {
        fetchESGAnalytics();
    }, [selectedTimeframe]);

    const fetchESGAnalytics = async () => {
        try {
            setLoading(true);
            const response = await authenticatedFetch(`${API_BASE_URL}/api/analytics/esg?timeframe=${selectedTimeframe}`);

            if (response.ok) {
                const data = await response.json();
                setEsgAnalytics(data);
            }
        } catch (error) {
            console.error('Error fetching ESG analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600 bg-green-50';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50';
        if (score >= 40) return 'text-orange-600 bg-orange-50';
        return 'text-red-600 bg-red-50';
    };

    const getTrendIcon = (trend) => {
        if (trend > 0) return <FaArrowUp className="text-green-500" />;
        if (trend < 0) return <FaTrendingDown className="text-red-500" />;
        return <FaChartLine className="text-gray-500" />;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900 transition-colors">
                <UrbanSetuSpinner size="xl" />
                <p className="text-gray-600 dark:text-gray-400 font-bold tracking-widest animate-pulse uppercase">Calculating ESG Metrics...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">ESG Analytics Dashboard</h1>
                            <p className="text-gray-600 mt-2">Environmental, Social & Governance Performance Metrics</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <select
                                value={selectedTimeframe}
                                onChange={(e) => setSelectedTimeframe(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                                <option value="90d">Last 90 Days</option>
                                <option value="1y">Last Year</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Properties</p>
                                <p className="text-2xl font-bold text-gray-900">{esgAnalytics.totalProperties}</p>
                            </div>
                            <FaBuilding className="text-2xl text-blue-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">ESG Rated</p>
                                <p className="text-2xl font-bold text-gray-900">{esgAnalytics.esgRatedProperties}</p>
                                <p className="text-sm text-gray-500">
                                    {((esgAnalytics.esgRatedProperties / esgAnalytics.totalProperties) * 100).toFixed(1)}% coverage
                                </p>
                            </div>
                            <FaStar className="text-2xl text-yellow-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Average ESG Score</p>
                                <p className="text-2xl font-bold text-gray-900">{esgAnalytics.averageEsgScore.toFixed(1)}</p>
                            </div>
                            <FaChartLine className="text-2xl text-green-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">ESG Trend</p>
                                <div className="flex items-center gap-2">
                                    {getTrendIcon(esgAnalytics.trends.overall)}
                                    <span className="text-lg font-bold text-gray-900">
                                        {esgAnalytics.trends.overall > 0 ? '+' : ''}{esgAnalytics.trends.overall}%
                                    </span>
                                </div>
                            </div>
                            <FaGlobe className="text-2xl text-purple-500" />
                        </div>
                    </div>
                </div>

                {/* ESG Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Environmental Metrics */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <FaLeaf className="text-green-500" />
                            <h3 className="text-lg font-semibold text-gray-900">Environmental</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Energy Efficiency</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.environmentalMetrics.energyEfficiency)}`}>
                                    {esgAnalytics.environmentalMetrics.energyEfficiency}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Renewable Energy</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.environmentalMetrics.renewableEnergy)}`}>
                                    {esgAnalytics.environmentalMetrics.renewableEnergy}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Waste Management</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.environmentalMetrics.wasteManagement)}`}>
                                    {esgAnalytics.environmentalMetrics.wasteManagement}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Green Certifications</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.environmentalMetrics.greenCertifications)}`}>
                                    {esgAnalytics.environmentalMetrics.greenCertifications}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Social Metrics */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <FaUsers className="text-blue-500" />
                            <h3 className="text-lg font-semibold text-gray-900">Social</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Accessibility</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.socialMetrics.accessibility)}`}>
                                    {esgAnalytics.socialMetrics.accessibility}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Community Impact</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.socialMetrics.communityImpact)}`}>
                                    {esgAnalytics.socialMetrics.communityImpact}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Affordable Housing</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.socialMetrics.affordableHousing)}`}>
                                    {esgAnalytics.socialMetrics.affordableHousing}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Diversity & Inclusion</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.socialMetrics.diversityInclusion)}`}>
                                    {esgAnalytics.socialMetrics.diversityInclusion}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Governance Metrics */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <FaShieldAlt className="text-purple-500" />
                            <h3 className="text-lg font-semibold text-gray-900">Governance</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Transparency</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.governanceMetrics.transparency)}`}>
                                    {esgAnalytics.governanceMetrics.transparency}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Ethical Standards</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.governanceMetrics.ethicalStandards)}`}>
                                    {esgAnalytics.governanceMetrics.ethicalStandards}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Compliance</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.governanceMetrics.compliance)}`}>
                                    {esgAnalytics.governanceMetrics.compliance}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Risk Management</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(esgAnalytics.governanceMetrics.riskManagement)}`}>
                                    {esgAnalytics.governanceMetrics.riskManagement}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Performers and Improvement Areas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top ESG Performers */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FaStar className="text-yellow-500" />
                            Top ESG Performers
                        </h3>
                        <div className="space-y-3">
                            {esgAnalytics.topPerformers.map((property, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900">{property.name}</p>
                                        <p className="text-sm text-gray-600">{property.location}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-600">{property.esgScore}</p>
                                        <p className="text-xs text-gray-500">{property.esgRating}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Improvement Areas */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FaInfoCircle className="text-blue-500" />
                            Key Improvement Areas
                        </h3>
                        <div className="space-y-3">
                            {esgAnalytics.improvementAreas.map((area, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900">{area.category}</p>
                                        <p className="text-sm text-gray-600">{area.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-yellow-600">{area.priority}</p>
                                        <p className="text-xs text-gray-500">Priority</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
