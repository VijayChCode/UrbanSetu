import React from 'react';
import { FaPhone, FaVideo, FaPhoneSlash, FaExpand, FaClock } from 'react-icons/fa';

const OngoingCallBar = ({ 
  otherPartyName, 
  callType, 
  callDuration, 
  onReturn, 
  onEndCall,
  isReconnecting,
  reconnectReason,
  callState,
  onAccept
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
      
      <div className="bg-gray-900 border-b border-white/10 shadow-2xl backdrop-blur-md bg-opacity-95 px-2 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-1 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl flex-shrink-0 ${isReconnecting ? 'bg-amber-500 animate-pulse' : 'bg-blue-600'} shadow-lg`}>
            {callType === 'video' ? <FaVideo className="text-white text-xs sm:text-base" /> : <FaPhone className="text-white text-xs sm:text-base" />}
          </div>
          
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <span className="text-white font-bold tracking-tight text-xs sm:text-base truncate">
                {callState === 'ringing' ? 'In:' : 'Call:'} {otherPartyName || 'Participant'}
              </span>
              {isReconnecting && (
                <span className="text-[8px] sm:text-[10px] bg-amber-500 text-black font-extrabold px-1 sm:px-1.5 py-0.5 rounded uppercase animate-pulse flex-shrink-0">
                  {reconnectReason === 'local-offline' ? 'Poor' : 
                   reconnectReason === 'remote-disconnected' ? 'Offline' : 'Rec'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-gray-400 text-[10px] sm:text-xs font-medium">
              <FaClock className="text-[8px] sm:text-[10px]" />
              <span className="truncate">{callState === 'ringing' ? 'Ringing' : formatDuration(callDuration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {callState === 'ringing' ? (
            <button
              onClick={onAccept}
              className="flex items-center justify-center gap-1.5 sm:gap-2 bg-green-600 hover:bg-green-500 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg group"
              title="Answer Call"
            >
              <FaPhone className="text-[10px] sm:text-xs group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Answer</span>
            </button>
          ) : (
            <button
              onClick={onReturn}
              className="flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg group"
              title="Return to Call"
            >
              <FaExpand className="text-[10px] sm:text-xs group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Return</span>
              <span className="hidden sm:inline text-nowrap">to Call</span>
            </button>
          )}
          
          <button
            onClick={onEndCall}
            className="flex items-center justify-center gap-1.5 sm:gap-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-all border border-red-500/30 hover:border-red-500 shadow-lg"
            title={callState === 'ringing' ? 'Decline Call' : 'End Call'}
          >
            <FaPhoneSlash className="text-[10px] sm:text-xs rotate-[135deg]" />
            <span className="hidden sm:inline">{callState === 'ringing' ? 'Decline' : 'End'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OngoingCallBar;