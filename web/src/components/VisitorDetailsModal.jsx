import React, { useState } from 'react';
import {
    FaTimes, FaSync, FaFingerprint, FaClock, FaMapMarkerAlt, FaHistory, FaArrowDown, FaExclamationTriangle
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import UrbanSetuSpinner from './UrbanSetuSpinner';

const calculateDuration = (start, lastActive) => {
    if (!start || !lastActive) return '0s';
    const startTime = new Date(start).getTime();
    const endTime = new Date(lastActive).getTime();
    if (isNaN(startTime) || isNaN(endTime)) return '0s';

    const diffMs = Math.max(0, endTime - startTime);
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    const remainingSec = diffSec % 60;

    return `${diffMin}m ${remainingSec}s`;
};

const VisitorDetailsModal = ({ visitor, onClose, onRefresh, isRefreshing }) => {
    const [drillDownData, setDrillDownData] = useState([]);
    const [drillDownType, setDrillDownType] = useState(''); // 'interactions' or 'errors'
    const [showDrillDownModal, setShowDrillDownModal] = useState(false);

    if (!visitor) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                            <FaFingerprint className="text-xl" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Visitor Session Details</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <FaClock className="text-[10px]" />
                                Duration: {calculateDuration(visitor.sessionStart || visitor.timestamp, visitor.lastActive || visitor.timestamp)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                disabled={isRefreshing}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                title="Refresh details"
                            >
                                {isRefreshing ? <UrbanSetuSpinner size="sm" /> : <FaSync />}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                    {/* Session ID & Source */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Device Info</p>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Device:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{visitor.device} ({visitor.deviceType})</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">OS:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{visitor.os}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Browser:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{visitor.browser} {visitor.browserVersion}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">IP:</span>
                                    <span className="font-mono text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">{visitor.ip}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Acquisition</p>
                            <div className="space-y-1">
                                <div className="flex flex-col gap-1 text-sm">
                                    <span className="text-gray-600 dark:text-gray-400 text-xs font-semibold">Source:</span>
                                    <span className="font-medium text-gray-900 dark:text-white break-all text-xs">{visitor.source}</span>
                                </div>
                                <div className="flex flex-col gap-1 text-sm mt-2">
                                    <span className="text-gray-600 dark:text-gray-400 text-xs font-semibold">Referrer:</span>
                                    <span className="font-medium text-gray-900 dark:text-white break-all text-xs">{visitor.referrer || 'Direct'}</span>
                                </div>
                                {visitor.utm && Object.keys(visitor.utm).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                        {Object.entries(visitor.utm).map(([key, val]) => (
                                            <div key={key} className="flex items-center justify-between text-xs">
                                                <span className="text-gray-500">{key}:</span>
                                                <span className="text-gray-700 dark:text-gray-300 font-mono">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Location & Consent</p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                                    <FaMapMarkerAlt className="text-red-500" />
                                    {visitor.location}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {visitor.cookiePreferences?.analytics ?
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded border border-green-200">Analytics: On</span> :
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded border border-gray-200">Analytics: Off</span>}
                                    {visitor.cookiePreferences?.marketing ?
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded border border-green-200">Marketing: On</span> :
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded border border-gray-200">Marketing: Off</span>}
                                    {visitor.cookiePreferences?.functional ?
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded border border-green-200">Functional: On</span> :
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded border border-gray-200">Functional: Off</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Clickstream / Page Views Timeline */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FaHistory className="text-blue-500" /> Session Timeline
                        </h4>
                        <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-6">
                            {visitor.pageViews?.map((pv, idx) => (
                                <div key={idx} className="relative pl-6">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-gray-800"></div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <p className="text-sm font-bold text-gray-800 dark:text-white">{pv.path}</p>
                                                {pv.scrollPercentage > 0 && (
                                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-200 dark:border-blue-800 cursor-help" title={`Max Scroll Depth: ${pv.scrollPercentage}%`}>
                                                        <FaArrowDown className="text-[8px]" /> Scrolled {pv.scrollPercentage}%
                                                    </span>
                                                )}
                                                {pv.loadTime > 0 && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border cursor-help ${pv.loadTime < 1000 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' :
                                                        pv.loadTime < 3000 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' :
                                                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                                        }`} title={`Page Load Time: ${Math.round(pv.loadTime)}ms`}>
                                                        <FaClock className="text-[8px]" /> {Math.round(pv.loadTime)}ms
                                                    </span>
                                                )}
                                                {pv.interactions?.length > 0 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDrillDownData(pv.interactions); setDrillDownType('interactions'); setShowDrillDownModal(true); }}
                                                        className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                                                        title="Click to view details"
                                                    >
                                                        <FaFingerprint className="text-[8px]" /> {pv.interactions.length} Actions
                                                    </button>
                                                )}
                                                {(pv.errorLogs || pv.errors)?.length > 0 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDrillDownData(pv.errorLogs || pv.errors); setDrillDownType('errors'); setShowDrillDownModal(true); }}
                                                        className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                                                        title="Click to view errors"
                                                    >
                                                        <FaExclamationTriangle className="text-[8px]" /> {(pv.errorLogs || pv.errors).length} Errors
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{pv.title || 'Page View'}</p>
                                        </div>
                                        <span className="text-xs font-mono text-gray-400 mt-2 sm:mt-0">
                                            {new Date(pv.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {(!visitor.pageViews || visitor.pageViews.length === 0) && (
                                <div className="relative pl-6">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-300"></div>
                                    <p className="text-sm text-gray-500">No page view history available.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg shadow-gray-200 dark:shadow-none"
                    >
                        Close Details
                    </button>
                </div>
            </div>

            {/* Detailed Drill-Down Modal (Interactions/Errors) */}
            {showDrillDownModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${drillDownType === 'interactions' ? 'bg-purple-100 text-purple-600' : 'bg-red-100 text-red-600'}`}>
                                    {drillDownType === 'interactions' ? <FaFingerprint className="text-lg" /> : <FaExclamationTriangle className="text-lg" />}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                                    {drillDownType === 'interactions' ? 'User Interactions' : 'Error Logs'}
                                </h3>
                            </div>
                            <button onClick={() => setShowDrillDownModal(false)} className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full p-2 transition-colors">
                                <FaTimes />
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto custom-scrollbar">
                            {drillDownData.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No details available.</div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {drillDownData.map((item, idx) => (
                                        <div key={idx} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors flex gap-3">
                                            <div className="mt-1">
                                                <div className={`w-2 h-2 rounded-full ${drillDownType === 'interactions' ? 'bg-purple-500' : 'bg-red-500'}`}></div>
                                            </div>
                                            <div className="flex-1">
                                                {drillDownType === 'interactions' ? (
                                                    <>
                                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                                            {item.action || 'Click'} on <span className="font-mono text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded">{item.element || 'Unknown'}</span>
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm font-bold text-red-600 dark:text-red-400 break-words">
                                                            {item.message || 'Unknown Error'}
                                                        </p>
                                                        {item.source && (
                                                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                                                {item.source}
                                                            </p>
                                                        )}
                                                        {item.stack && (
                                                            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto custom-scrollbar">
                                                                {item.stack}
                                                            </pre>
                                                        )}
                                                    </>
                                                )}
                                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                    <FaClock className="text-[10px]" /> {new Date(item.timestamp).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end">
                            <button
                                onClick={() => setShowDrillDownModal(false)}
                                className="px-5 py-2 bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisitorDetailsModal;
