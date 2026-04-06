import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const NetworkStatus = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isOnline || (isOnline && wasOffline)) {
      setIsVisible(true);

      // Auto-hide success message after 4 seconds
      if (isOnline && wasOffline) {
        const timer = setTimeout(() => setIsVisible(false), 4000);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [isOnline, wasOffline]);

  if (!isVisible && isOnline && !wasOffline) return null;

  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] transition-all duration-500 ease-in-out ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
      <div className={`
        flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border 
        transition-all duration-300
        ${!isOnline
          ? 'bg-slate-900/90 border-red-500/30 text-white shadow-red-900/20'
          : 'bg-white/90 border-green-500/30 text-slate-800 shadow-green-900/10'}
      `}>
        {/* Icon Container */}
        <div className={`
          p-2 rounded-full flex items-center justify-center
          ${!isOnline ? 'bg-red-500/20' : 'bg-green-500/20'}
        `}>
          {!isOnline ? (
            <WifiOff className="w-5 h-5 text-red-500 animate-pulse" />
          ) : (
            <Wifi className="w-5 h-5 text-green-600" />
          )}
        </div>

        {/* Text Content */}
        <div className="flex flex-col min-w-[200px]">
          <h3 className={`text-sm font-bold ${!isOnline ? 'text-red-400' : 'text-green-600'}`}>
            {!isOnline ? 'No Internet Connection' : 'Connection Restored'}
          </h3>
          <p className={`text-xs mt-0.5 font-medium ${!isOnline ? 'text-gray-400' : 'text-gray-500'}`}>
            {!isOnline ? 'Trying to reconnect...' : 'You are back online'}
          </p>
        </div>

        {/* Status Indicator / Action */}
        <div className="pl-3 border-l border-gray-500/20">
          {!isOnline ? (
            <div className="flex items-center gap-2">
              <UrbanSetuSpinner size="sm" />
            </div>
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;