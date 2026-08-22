import React from 'react';
import { Link } from 'react-router-dom';
import { FaMapMarkerAlt, FaStar, FaBuilding, FaUserTie, FaCheckCircle, FaAward } from 'react-icons/fa';
import { useSelector } from 'react-redux';

const AgentCard = ({ agent }) => {
    const { currentUser } = useSelector(state => state.user);
    const profileUrl = currentUser ? `/user/agents/${agent._id}` : `/agents/${agent._id}`;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700/80 flex flex-col group hover:-translate-y-1">
            {/* Header / Cover (Pattern) */}
            <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {agent.isVerified && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 dark:bg-gray-900/90 text-blue-600 dark:text-blue-400 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-sm">
                            <FaCheckCircle className="text-xs text-blue-500" /> Verified
                        </span>
                    )}
                </div>
            </div>

            <div className="px-5 pt-0 pb-5 relative flex-grow flex flex-col">
                {/* Avatar & Rating Header */}
                <div className="relative -mt-12 mb-3 flex justify-between items-end">
                    <div className="relative">
                        <img
                            src={agent.photo || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                            alt={agent.name}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-md bg-white dark:bg-gray-700 group-hover:scale-105 transition-transform duration-300"
                        />
                    </div>
                    <div className="mb-1 flex flex-col items-end">
                        {agent.rating > 0 ? (
                            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 px-2.5 py-1 rounded-xl shadow-xs">
                                <FaStar className="text-amber-500 text-xs" />
                                <span className="font-bold text-gray-900 dark:text-amber-200 text-xs">{agent.rating.toFixed(1)}</span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">({agent.reviewCount || 0})</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded-lg">
                                <span className="text-[11px] text-gray-400 font-medium">New Agent</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                        {agent.name}
                    </h3>
                    {agent.agencyName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-2 line-clamp-1">
                            <FaBuilding className="text-blue-500 text-xs shrink-0" /> {agent.agencyName}
                        </p>
                    )}

                    <div className="flex items-center text-xs text-gray-600 dark:text-gray-300 mb-3">
                        <FaMapMarkerAlt className="text-red-500 mr-1.5 shrink-0" />
                        <span className="truncate">{agent.city} {agent.areas?.length > 0 && `• ${agent.areas.slice(0, 2).join(', ')}${agent.areas.length > 2 ? '...' : ''}`}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Experience Badge */}
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-lg border border-blue-100 dark:border-blue-800 font-medium">
                            {agent.experience || 0} {(agent.experience === 1) ? 'Yr' : 'Yrs'} Exp
                        </span>
                        {/* RERA Badge (if exists) */}
                        {agent.reraId && (
                            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-lg border border-emerald-100 dark:border-emerald-800 font-medium flex items-center gap-1">
                                <FaAward className="text-[10px]" /> RERA Reg.
                            </span>
                        )}
                    </div>
                </div>

                {/* View Profile Action */}
                <div className="mt-auto pt-2">
                    <Link
                        to={profileUrl}
                        className="block w-full text-center py-2.5 bg-gray-900 hover:bg-blue-600 dark:bg-white dark:hover:bg-blue-500 text-white dark:text-gray-900 dark:hover:text-white rounded-xl transition-all duration-200 font-semibold text-sm shadow-sm group-hover:shadow-md"
                    >
                        View Profile
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AgentCard;
