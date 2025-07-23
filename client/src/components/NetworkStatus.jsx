import React from 'react';
import { FaWifi, FaExclamationTriangle, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const NetworkStatus = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  // Don't show anything if online and was never offline
  if (isOnline && !wasOffline) {
    return null;
  }

  // Show reconnection message briefly when coming back online
  if (isOnline && wasOffline) {
    return (
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in">
        <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-down">
          <FaCheckCircle className="text-xl animate-pulse" />
          <div className="text-center">
            <p className="font-semibold text-sm">Connection Restored!</p>
            <p className="text-xs opacity-90">You're back online</p>
          </div>
        </div>
      </div>
    );
  }

  // Show offline message when no internet
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in">
      <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-down">
        <FaTimesCircle className="text-xl animate-pulse" />
        <div className="text-center">
          <p className="font-semibold text-sm flex items-center gap-2">
            <FaExclamationTriangle className="text-yellow-300" />
            Internet Not Available
          </p>
          <p className="text-xs opacity-90">Please check your connection</p>
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;