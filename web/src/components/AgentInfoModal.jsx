import React from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaUserTie, FaHandshake, FaBullseye, FaQuestionCircle, FaShieldAlt } from 'react-icons/fa';

export default function AgentInfoModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-fadeIn" style={{ isolation: 'isolate' }}>
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all scale-100 animate-slideUp"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <FaQuestionCircle className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">About UrbanSetu Agents</h2>
                            <p className="text-xs text-blue-100 opacity-90">Everything you need to know</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8">

                    {/* Section 1: What is an Agent? */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 mt-1">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center">
                                <FaUserTie className="text-lg" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">What is an UrbanSetu Agent?</h3>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                                An UrbanSetu Agent is a verified real estate professional dedicated to simplifying your property journey. Unlike traditional brokers, our partners are vetted for expertise, integrity, and local market knowledge ensuring you get the best guidance without the hassle.
                            </p>
                        </div>
                    </div>

                    {/* Section 2: Who are they? */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 mt-1">
                            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center">
                                <FaBullseye className="text-lg" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Who are our Agents?</h3>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                                Our agents are industry veterans, top-rated property consultants, and certified legal experts. They undergo a rigorous "Root Verification" process to earn the UrbanSetu badge. They are not just salespeople; they are your personal property advisors.
                            </p>
                        </div>
                    </div>

                    {/* Section 3: The Motto */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700/50 dark:to-gray-700/30 p-4 rounded-xl border border-blue-100 dark:border-gray-600">
                        <div className="flex items-center gap-3 mb-2">
                            <FaShieldAlt className="text-blue-600 dark:text-blue-400" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Our Motto</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 italic font-medium">
                            "Connecting Hearts to Homes with Unshakeable Trust and Radical Transparency."
                        </p>
                    </div>

                    {/* Section 4: What happens when you contact? */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 mt-1">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center">
                                <FaHandshake className="text-lg" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">What happens when you contact?</h3>
                            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                                    <span><strong>Instant Connection:</strong> You start a direct, secure chat with the agent. No middle-men.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                                    <span><strong>Virtual & Physical Viewing:</strong> Schedule 360° virtual tours or on-site visits at your convenience.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                                    <span><strong>Transparent Deal:</strong> Negotiate price, verify documents, and close the deal securely via UrbanSetu Contracts.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 dark:bg-gray-700/30 rounded-b-2xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-900 dark:bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-500 transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
            <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out forwards; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
        </div>,
        document.body
    );
}
