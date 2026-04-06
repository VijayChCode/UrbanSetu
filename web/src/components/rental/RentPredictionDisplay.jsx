import React from 'react';
import { FaChartLine, FaDollarSign, FaEquals, FaInfoCircle } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';
import { TrendingUp, TrendingDown } from "lucide-react";

export default function RentPredictionDisplay({ prediction, loading, onGenerate }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <UrbanSetuSpinner size="md" className="mr-3" />
        <span className="text-gray-600 dark:text-gray-300">Generating prediction...</span>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
        <FaInfoCircle className="text-3xl text-yellow-600 dark:text-yellow-500 mx-auto mb-3" />
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">No Prediction Available</h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
          Generate an AI-powered rent prediction to see market insights and future trends.
        </p>
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Generate Prediction
          </button>
        )}
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || 0}`;
  };

  const getPriceComparisonIcon = () => {
    switch (prediction.priceComparison) {
      case 'overpriced':
        return <TrendingUp className="text-red-600 dark:text-red-400 w-5 h-5" />;
      case 'underpriced':
        return <TrendingDown className="text-green-600 dark:text-green-400 w-5 h-5" />;
      default:
        return <FaEquals className="text-blue-600 dark:text-blue-400" />;
    }
  };

  const getPriceComparisonColor = () => {
    switch (prediction.priceComparison) {
      case 'overpriced':
        return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'underpriced':
        return 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      default:
        return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const getPriceComparisonLabel = () => {
    switch (prediction.priceComparison) {
      case 'overpriced':
        return 'Overpriced';
      case 'underpriced':
        return 'Underpriced';
      default:
        return 'Fair Price';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FaChartLine className="text-blue-600 dark:text-blue-400" />
          AI Rent Prediction
        </h3>
        {prediction.accuracy && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Accuracy: {prediction.accuracy}%
          </span>
        )}
      </div>

      {/* Main Prediction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Predicted Rent */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Predicted Rent</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(prediction.predictedRent)}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">AI Estimated</p>
        </div>

        {/* Market Average */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg p-4">
          <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Market Average</p>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{formatCurrency(prediction.marketAverageRent)}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            Based on {prediction.similarPropertiesCount || prediction.dataPointsUsed || 0} similar properties
          </p>
        </div>

        {/* Price Comparison */}
        <div className={`border rounded-lg p-4 ${getPriceComparisonColor()}`}>
          <div className="flex items-center gap-2 mb-1">
            {getPriceComparisonIcon()}
            <p className="text-sm font-semibold">{getPriceComparisonLabel()}</p>
          </div>
          <p className="text-2xl font-bold">
            {prediction.priceDifference > 0 ? '+' : ''}{prediction.priceDifference?.toFixed(1)}%
          </p>
          <p className="text-xs mt-1">
            {Math.abs(prediction.priceDifference || 0).toFixed(1)}% difference from market
          </p>
        </div>
      </div>

      {/* Future Rent Predictions */}
      {prediction.predictedFutureRent && prediction.predictedFutureRent.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" /> Future Rent Predictions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {prediction.predictedFutureRent.map((future, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">Year {future.year}</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{formatCurrency(future.predictedRent)}</p>
                {future.confidence && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Confidence: {future.confidence}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Influencing Factors */}
      {prediction.influencingFactors && prediction.influencingFactors.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Key Factors</h4>
          <div className="space-y-2">
            {prediction.influencingFactors.map((factor, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-800 dark:text-gray-200 capitalize">{factor.factor.replace('_', ' ')}</p>
                  {factor.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{factor.description}</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded text-sm font-semibold ${factor.impact > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                  {factor.impact > 0 ? '+' : ''}{factor.impact}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Information */}
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-xs text-gray-600 dark:text-gray-400">
        <p>Model Version: {prediction.modelVersion || '1.0'}</p>
        <p>Data Points: {prediction.dataPointsUsed || 0} similar properties analyzed</p>
        {prediction.predictedAt && (
          <p>Last Updated: {new Date(prediction.predictedAt).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
}

