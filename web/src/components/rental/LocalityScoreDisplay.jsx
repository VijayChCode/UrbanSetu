import React from 'react';
import { FaShieldAlt, FaRoad, FaTint, FaGraduationCap, FaBuilding, FaTrafficLight, FaShoppingCart, FaHospital, FaStore, FaStar } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';

export default function LocalityScoreDisplay({ localityScore, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <UrbanSetuSpinner size="md" className="mr-3" />
        <span className="text-gray-600 dark:text-gray-300">Calculating locality score...</span>
      </div>
    );
  }

  if (!localityScore) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
        <FaStar className="text-3xl text-yellow-600 dark:text-yellow-500 mx-auto mb-3" />
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Locality Score Not Available</h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Locality score will be calculated when rent prediction is generated.
        </p>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    if (score >= 6) return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    if (score >= 4) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Average';
    return 'Below Average';
  };

  const scoreCategories = [
    { key: 'safety', label: 'Safety', icon: <FaShieldAlt />, weight: 20 },
    { key: 'accessibility', label: 'Accessibility', icon: <FaRoad />, weight: 15 },
    { key: 'waterAvailability', label: 'Water Supply', icon: <FaTint />, weight: 10 },
    { key: 'schools', label: 'Schools', icon: <FaGraduationCap />, weight: 10 },
    { key: 'offices', label: 'Offices', icon: <FaBuilding />, weight: 10 },
    { key: 'traffic', label: 'Traffic', icon: <FaTrafficLight />, weight: 10 },
    { key: 'grocery', label: 'Grocery', icon: <FaShoppingCart />, weight: 10 },
    { key: 'medical', label: 'Medical', icon: <FaHospital />, weight: 8 },
    { key: 'shopping', label: 'Shopping', icon: <FaStore />, weight: 7 }
  ];

  const overallScore = localityScore.overall || 0;
  const overallColor = getScoreColor(overallScore);
  const overallLabel = getScoreLabel(overallScore);

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center justify-center gap-2">
          <FaStar className="text-yellow-500" />
          Locality Score
        </h3>
        <div className={`inline-flex flex-col items-center justify-center p-6 rounded-full border-4 ${overallColor} border-current`}>
          <div className="text-5xl font-bold mb-2 text-gray-800 dark:text-gray-100">{overallScore.toFixed(1)}</div>
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">/ 10</div>
          <div className="text-xs mt-2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full font-medium shadow-sm">
            {overallLabel}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div>
        <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Score Breakdown</h4>
        <div className="space-y-3">
          {scoreCategories.map((category) => {
            const score = localityScore[category.key] || 0;
            const percentage = (score / 10) * 100;
            const color = getScoreColor(score);

            return (
              <div key={category.key} className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${color.includes('text-green') ? 'text-green-600 dark:text-green-400' : color.includes('text-blue') ? 'text-blue-600 dark:text-blue-400' : color.includes('text-yellow') ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {category.icon}
                    </span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{category.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({category.weight}% weight)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${color}`}>
                      {score.toFixed(1)}/10
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${percentage >= 80 ? 'bg-green-500' :
                        percentage >= 60 ? 'bg-blue-500' :
                          percentage >= 40 ? 'bg-yellow-500' :
                            'bg-red-500'
                      }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Interpretation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Score Interpretation</h4>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p><strong>8.0 - 10.0:</strong> Excellent locality with great amenities and connectivity</p>
          <p><strong>6.0 - 7.9:</strong> Good locality with decent amenities</p>
          <p><strong>4.0 - 5.9:</strong> Average locality, basic amenities available</p>
          <p><strong>0.0 - 3.9:</strong> Below average, limited amenities</p>
        </div>
      </div>
    </div>
  );
}

