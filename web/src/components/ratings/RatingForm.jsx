import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaStar, FaCheckCircle } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';
import { authenticatedFetch } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const StarRating = ({ rating, onRatingChange, label, required = false }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <FaStar
              className={`text-2xl ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'
                }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">({rating}/5)</span>
        )}
      </div>
    </div>
  );
};

export default function RatingForm({ contract, role, currentUser, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState({
    overallRating: 0,
    ...(role === 'tenant' ? {
      behaviorRating: 0,
      maintenanceRating: 0,
      honestyRating: 0,
      communicationRating: 0
    } : {
      cleanlinessRating: 0,
      paymentPunctuality: 0,
      behaviorRating: 0,
      propertyCare: 0
    })
  });
  const [comment, setComment] = useState('');

  const handleRatingChange = (key, value) => {
    setRatings(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate overall rating is required
    if (!ratings.overallRating || ratings.overallRating === 0) {
      toast.error('Please provide an overall rating');
      return;
    }

    // Validate at least one detailed rating
    const detailedRatings = Object.keys(ratings).filter(key => key !== 'overallRating');
    const hasDetailedRating = detailedRatings.some(key => ratings[key] > 0);

    if (!hasDetailedRating) {
      toast.error('Please provide at least one detailed rating');
      return;
    }

    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/ratings/${contract._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings,
          comment,
          role
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Rating submitted successfully');
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.message || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  const isTenant = role === 'tenant';
  const otherParty = isTenant ? contract.landlordId : contract.tenantId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Contract Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">{contract.listingId?.name || 'Property'}</h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">Contract ID: {contract.contractId}</p>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {isTenant ? 'Landlord' : 'Tenant'}: {otherParty?.username || 'Unknown'}
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Note:</strong> Please provide honest ratings based on your rental experience.
          Your ratings will be visible to other users and help build trust in the platform.
        </p>
      </div>

      {/* Overall Rating */}
      <StarRating
        rating={ratings.overallRating}
        onRatingChange={(value) => handleRatingChange('overallRating', value)}
        label="Overall Rating"
        required
      />

      {/* Detailed Ratings */}
      {isTenant ? (
        <>
          <StarRating
            rating={ratings.behaviorRating}
            onRatingChange={(value) => handleRatingChange('behaviorRating', value)}
            label="Behavior & Communication"
          />
          <StarRating
            rating={ratings.maintenanceRating}
            onRatingChange={(value) => handleRatingChange('maintenanceRating', value)}
            label="Property Maintenance"
          />
          <StarRating
            rating={ratings.honestyRating}
            onRatingChange={(value) => handleRatingChange('honestyRating', value)}
            label="Honesty & Transparency"
          />
          <StarRating
            rating={ratings.communicationRating}
            onRatingChange={(value) => handleRatingChange('communicationRating', value)}
            label="Communication"
          />
        </>
      ) : (
        <>
          <StarRating
            rating={ratings.cleanlinessRating}
            onRatingChange={(value) => handleRatingChange('cleanlinessRating', value)}
            label="Cleanliness"
          />
          <StarRating
            rating={ratings.paymentPunctuality}
            onRatingChange={(value) => handleRatingChange('paymentPunctuality', value)}
            label="Payment Punctuality"
          />
          <StarRating
            rating={ratings.behaviorRating}
            onRatingChange={(value) => handleRatingChange('behaviorRating', value)}
            label="Behavior & Conduct"
          />
          <StarRating
            rating={ratings.propertyCare}
            onRatingChange={(value) => handleRatingChange('propertyCare', value)}
            label="Property Care"
          />
        </>
      )}

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Comment (Optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder={`Share your experience with this ${isTenant ? 'landlord' : 'tenant'}...`}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !ratings.overallRating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaCheckCircle />}
          {loading ? 'Submitting...' : 'Submit Rating'}
        </button>
      </div>
    </form>
  );
}

