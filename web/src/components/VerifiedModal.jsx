import React from 'react';
import { createPortal } from 'react-dom';
import { FaShieldAlt, FaCheckCircle, FaUser, FaHome } from 'react-icons/fa';

const VerifiedModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-fade-in px-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-green-100 dark:border-green-900 transform transition-all scale-100 animate-fade-in-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <FaShieldAlt className="text-9xl text-green-600" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-green-100 dark:border-green-800 relative z-10">
                        <FaCheckCircle className="text-5xl text-green-500 animate-pulse-slow" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white relative z-10">Verified Property</h3>
                    <p className="text-green-700 dark:text-green-300 font-medium text-sm mt-1 relative z-10">UrbanSetu Assured • 100% Genuine</p>


                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <p className="text-center text-gray-600 dark:text-gray-300 leading-relaxed">
                        This property has passed our rigorous verification process. You can progress with confidence knowing it is <span className="font-bold text-gray-800 dark:text-white">Authorized</span> and <span className="font-bold text-gray-800 dark:text-white">Genuine</span>.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-green-100 dark:hover:border-green-900/50">
                            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg mt-1 flex-shrink-0">
                                <FaUser className="text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">Authorized Owner</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ownership proof and identity have been validated.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-blue-100 dark:hover:border-blue-900/50">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mt-1 flex-shrink-0">
                                <FaShieldAlt className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">Genuine Listing</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Property details, photos, and location are authentic.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-purple-100 dark:hover:border-purple-900/50">
                            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg mt-1 flex-shrink-0">
                                <FaHome className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">Valid Status</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Currently available and active on the market.</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={onClose}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 dark:shadow-none transition-all transform hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                        >
                            Got it, thanks!
                        </button>
                    </div>
                </div>
            </div>
        </div>
        , document.body);
};

export default VerifiedModal;
