import React from 'react';
import { FaPhone, FaVideo, FaPhoneSlash, FaExpand, FaClock } from 'react-icons/fa';

const OngoingCallBar = ({ 
  otherPartyName, 
  callType, 
  callDuration, 
  onReturn, 
  onEndCall,
  isReconnecting,
  reconnectReason 
}) => {
  const formatDuration = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] animate-slideDown">
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      
      <div className="bg-gray-900 border-b border-white/10 shadow-2xl backdrop-blur-md bg-opacity-95 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl ${isReconnecting ? 'bg-amber-500 animate-pulse' : 'bg-blue-600'} shadow-lg`}>
            {callType === 'video' ? <FaVideo className="text-white" /> : <FaPhone className="text-white" />}
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold tracking-tight">Ongoing Call: {otherPartyName || 'Participant'}</span>
              {isReconnecting && (
                <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded uppercase animate-pulse">
                  {reconnectReason === 'local-offline' ? 'Poor Connection' : 
                   reconnectReason === 'remote-disconnected' ? 'Peer Offline' : 'Reconnecting'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium">
              <FaClock className="text-[10px]" />
              <span>{formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onReturn}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg group"
          >
            <FaExpand className="text-xs group-hover:rotate-12 transition-transform" />
            <span>Return to Call</span>
          </button>
          
          <button
            onClick={onEndCall}
            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all border border-red-500/30 hover:border-red-500 shadow-lg"
          >
            <FaPhoneSlash className="text-xs rotate-[135deg]" />
            <span>End</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OngoingCallBar;
