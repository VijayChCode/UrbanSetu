import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaCoins, FaCheckCircle, FaStar, FaTrophy, FaAward, FaRegGem, FaHandshake, FaDove, FaShieldAlt, FaTools, FaHome, FaInfoCircle } from 'react-icons/fa';

const SetuCoinInfoModal = ({ isOpen, onClose, headerClass = "from-orange-300 via-orange-400 to-orange-500" }) => {
    // Handle Esc key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="bg-white dark:bg-gray-800 max-w-lg w-full rounded-[2rem] shadow-2xl overflow-hidden relative z-10 animate-[scaleIn_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)] flex flex-col max-h-[90vh]">
                {/* Close Button */}


                {/* Modal Header */}
                <div className={`bg-gradient-to-br ${headerClass} p-6 md:p-8 text-white relative shrink-0`}>
                    <FaCoins className="absolute bottom-[-10px] right-[-10px] text-8xl text-white/20 rotate-12" />
                    <FaAward className="absolute top-4 right-4 text-4xl text-white/10" />
                    <h2 className="text-2xl md:text-3xl font-black mb-1 flex items-center gap-2 md:gap-3">
                        <FaTrophy className="text-yellow-200 animate-bounce" /> SetuCoins
                    </h2>
                    <p className="text-white/80 font-medium text-sm md:text-base">Your loyalty rewards ecosystem.</p>
                </div>

                {/* Modal Body */}
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    <section>
                        <h3 className="text-xs md:text-sm font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <FaStar className="text-yellow-500" /> What are SetuCoins?
                        </h3>
                        <p className="text-slate-600 dark:text-gray-300 leading-relaxed text-sm">
                            SetuCoins are UrbanSetu's exclusive reward currency. They represent our appreciation for long-term residents and active community members.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xs md:text-sm font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FaCheckCircle className="text-green-500" /> How to Earn?
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-slate-50 dark:bg-gray-700 p-3 rounded-xl border border-slate-100 dark:border-gray-600">
                                <p className="font-bold text-slate-800 dark:text-white text-xs mb-1">Rent Cashback</p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400">1% of every rent payment back in coins.</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-gray-700 p-3 rounded-xl border border-slate-100 dark:border-gray-600">
                                <p className="font-bold text-slate-800 dark:text-white text-xs mb-1">Consistency</p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400">Bonus for staying on streak.</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-gray-700 p-3 rounded-xl border border-slate-100 dark:border-gray-600">
                                <p className="font-bold text-slate-800 dark:text-white text-xs mb-1">Services</p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400">Earn by booking handyman/cleaning.</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-gray-700 p-3 rounded-xl border border-slate-100 dark:border-gray-600">
                                <p className="font-bold text-slate-800 dark:text-white text-xs mb-1">Engagement</p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400">Earn through platform activity.</p>
                            </div>
                        </div>
                    </section>
                    <section>
                        <h3 className="text-xs md:text-sm font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FaAward className="text-purple-500" /> Achievement Badges
                        </h3>
                        <div className="space-y-3">
                            {[
                                { name: 'Elite Resident', icon: <FaRegGem />, color: 'text-purple-500', desc: '6-month rent payment streak.' },
                                { name: 'Perfect Payer', icon: <FaHandshake />, color: 'text-green-500', desc: '12-month perfect payment streak.' },
                                { name: 'Early Bird', icon: <FaDove />, color: 'text-blue-500', desc: 'Pay 3 days before due date.' },
                                { name: 'Trusted Tenant', icon: <FaShieldAlt />, color: 'text-indigo-500', desc: 'Verified profile & high trust score.' },
                                { name: 'Service Pro', icon: <FaTools />, color: 'text-orange-500', desc: 'Property maintenance reporting.' },
                                { name: 'House Proud', icon: <FaHome />, color: 'text-pink-500', desc: 'Community participation.' },
                            ].map((badge, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-slate-50 dark:bg-gray-700/50 p-3 rounded-xl border border-slate-100 dark:border-gray-600/50">
                                    <div className={`w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center ${badge.color} shadow-sm shrink-0`}>
                                        {badge.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-xs">{badge.name}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400">{badge.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="bg-indigo-50 dark:bg-indigo-900/40 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50 flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-800 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-black text-lg">
                                ₹
                            </div>
                            <div>
                                <p className="text-slate-800 dark:text-white font-bold text-xs capitalize">Indian Currency Rate</p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400">Every 10 Coins = ₹1 Discount</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-lg">
                                $
                            </div>
                            <div>
                                <p className="text-slate-800 dark:text-white font-bold text-xs capitalize">Global Value Rate</p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400">Every 800 Coins = $1 Discount</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 md:py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-lg shrink-0"
                    >
                        Got it, Thanks!
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.8) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default SetuCoinInfoModal;
