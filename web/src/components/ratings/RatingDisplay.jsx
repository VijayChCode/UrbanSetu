import React from 'react';
import { useSelector } from 'react-redux';
import { FaStar, FaUser, FaCheckCircle, FaClock, FaHome } from 'react-icons/fa';
import UserAvatar from '../UserAvatar';

export default function RatingDisplay({ rating, contract, currentUser, onUpdate }) {
  const tenantRating = rating.tenantToLandlordRating;
  const landlordRating = rating.landlordToTenantRating;

  const renderStarRating = (rating) => {
    if (!rating || rating === 0) return null;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <FaStar
            key={i}
            className={`text-lg ${i < fullStars ? 'text-yellow-400 fill-current' :
              i === fullStars && hasHalfStar ? 'text-yellow-400 fill-current opacity-50' :
                'text-gray-300'
              }`}
          />
        ))}
        <span className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{rating.toFixed(1)}/5</span>
      </div>
    );
  };

  const renderDetailedRatings = (ratingData, isTenantRating) => {
    if (!ratingData?.overallRating) return null;

    const ratingItems = isTenantRating ? [
      { key: 'behaviorRating', label: 'Behavior & Communication' },
      { key: 'maintenanceRating', label: 'Property Maintenance' },
      { key: 'honestyRating', label: 'Honesty & Transparency' },
      { key: 'communicationRating', label: 'Communication' }
    ] : [
      { key: 'cleanlinessRating', label: 'Cleanliness' },
      { key: 'paymentPunctuality', label: 'Payment Punctuality' },
      { key: 'behaviorRating', label: 'Behavior & Conduct' },
      { key: 'propertyCare', label: 'Property Care' }
    ];

    return (
      <div className="space-y-2">
        {ratingItems.map((item) => {
          const value = ratingData[item.key];
          if (!value || value === 0) return null;

          return (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">{item.label}:</span>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <FaStar
                    key={i}
                    className={`text-sm ${i < value ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'
                      }`}
                  />
                ))}
                <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">({value}/5)</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Contract Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">{contract.listingId?.name || 'Property'}</h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">Contract ID: {contract.contractId}</p>
        <p className="text-sm text-blue-700 dark:text-blue-300">Rent: ₹{contract.lockedRentAmount?.toLocaleString()}/month</p>
      </div>

      {/* Tenant to Landlord Rating */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <FaUser className="text-blue-600 dark:text-blue-400" />
          Tenant's Rating of Landlord
        </h3>
        {tenantRating?.overallRating ? (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserAvatar user={rating.tenantId} size="w-8 h-8" textSize="text-sm" />
                  <span className="font-medium text-gray-800 dark:text-white">{rating.tenantId?.username || 'Tenant'}</span>
                </div>
                {tenantRating.ratedAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Rated on: {new Date(tenantRating.ratedAt).toLocaleString()}
                  </p>
                )}
              </div>
              {renderStarRating(tenantRating.overallRating)}
            </div>

            {renderDetailedRatings(tenantRating, true)}

            {tenantRating.comment && (
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comment:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{tenantRating.comment}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <FaClock /> Tenant rating pending
            </div>
          </div>
        )}
      </div>

      {/* Landlord to Tenant Rating */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <FaUser className="text-green-600 dark:text-green-400" />
          Landlord's Rating of Tenant
        </h3>
        {landlordRating?.overallRating ? (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserAvatar user={rating.landlordId} size="w-8 h-8" textSize="text-sm" />
                  <span className="font-medium text-gray-800 dark:text-white">{rating.landlordId?.username || 'Landlord'}</span>
                </div>
                {landlordRating.ratedAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Rated on: {new Date(landlordRating.ratedAt).toLocaleString()}
                  </p>
                )}
              </div>
              {renderStarRating(landlordRating.overallRating)}
            </div>

            {renderDetailedRatings(landlordRating, false)}

            {landlordRating.comment && (
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comment:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{landlordRating.comment}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <FaClock /> Landlord rating pending
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {rating.bothRated && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
          <FaCheckCircle className="text-green-600 dark:text-green-400" />
          <span className="font-semibold text-green-800 dark:text-green-200">Both parties have completed their ratings</span>
          {rating.allRatingsCompletedAt && (
            <span className="text-xs text-green-600 dark:text-green-400 ml-auto">
              Completed: {new Date(rating.allRatingsCompletedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Rating ID */}
      <div className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t dark:border-gray-700">
        Rating ID: <span className="font-mono">{rating.ratingId}</span>
      </div>
    </div>
  );
}

