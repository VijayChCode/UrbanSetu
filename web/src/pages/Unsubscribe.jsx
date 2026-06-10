import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaEnvelopeOpenText, FaCheckCircle, FaExclamationCircle, FaArrowLeft, FaArrowRight, FaHome, FaPaperPlane, FaInfoCircle } from 'react-icons/fa';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import UrbanSetuSpinner from '../components/UrbanSetuSpinner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function DragSlider({ onConfirm, loading }) {
    const containerRef = useRef(null);
    const [dragWidth, setDragWidth] = useState(0);
    const x = useMotionValue(0);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                // w-14 is 56px, p-1 is 4px on each side (total 8px)
                setDragWidth(Math.max(0, containerWidth - 56 - 8));
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Transform opacity of helper text based on drag progress
    const textOpacity = useTransform(x, [0, dragWidth || 1], [1, 0.15]);
    const bgFillWidth = useTransform(x, [0, dragWidth || 1], ['0%', '100%']);

    const handleDragEnd = () => {
        if (x.get() >= dragWidth * 0.9 && !loading) {
            onConfirm();
        } else {
            x.set(0);
        }
    };

    useEffect(() => {
        if (!loading) {
            x.set(0);
        }
    }, [loading]);

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-16 bg-slate-100/90 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-1 border border-slate-200/80 dark:border-slate-800 flex items-center overflow-hidden select-none transition-colors duration-300"
        >
            {!loading && (
                <motion.div 
                    style={{ width: bgFillWidth }}
                    className="absolute left-0 top-0 bottom-0 bg-emerald-500/10 dark:bg-emerald-500/20 pointer-events-none rounded-l-2xl"
                />
            )}

            <AnimatePresence mode="wait">
                {!loading ? (
                    <motion.div 
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ opacity: textOpacity }}
                        className="absolute inset-0 flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 font-bold text-sm tracking-wide pointer-events-none select-none"
                    >
                        <span>Swipe to Unsubscribe</span>
                        
                        <div className="flex items-center gap-1">
                            <motion.span
                                animate={{ opacity: [0.3, 1, 0.3], x: [-2, 2, -2] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", times: [0, 0.5, 1] }}
                            >
                                <FaArrowRight className="text-emerald-600 dark:text-emerald-400 text-xs" />
                            </motion.span>
                            <motion.span
                                animate={{ opacity: [0.3, 1, 0.3], x: [-2, 2, -2] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.3, times: [0, 0.5, 1] }}
                            >
                                <FaArrowRight className="text-emerald-600/75 dark:text-emerald-400/75 text-xs" />
                            </motion.span>
                            <motion.span
                                animate={{ opacity: [0.3, 1, 0.3], x: [-2, 2, -2] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.6, times: [0, 0.5, 1] }}
                            >
                                <FaArrowRight className="text-emerald-600/50 dark:text-emerald-400/50 text-xs" />
                            </motion.span>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="spinner"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                    >
                        <UrbanSetuSpinner size="sm" isBright={true} />
                    </motion.div>
                )}
            </AnimatePresence>

            {!loading && (
                <motion.div
                    drag="x"
                    dragElastic={0.1}
                    dragMomentum={false}
                    dragConstraints={{ left: 0, right: dragWidth }}
                    onDragEnd={handleDragEnd}
                    style={{ x }}
                    className="w-14 h-14 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg shadow-emerald-500/25 z-10 transition-colors duration-200"
                >
                    <FaArrowRight className="text-lg" />
                </motion.div>
            )}
        </div>
    );
}


const reasons = [
    { id: 'no_longer_want', label: 'I no longer want to receive these emails' },
    { id: 'not_relevant', label: 'The content is not relevant to me' },
    { id: 'too_many', label: 'I receive too many emails' },
    { id: 'not_remember', label: "I don't remember signing up" },
    { id: 'other', label: 'Other' },
];

export default function Unsubscribe() {
    const { currentUser } = useSelector(state => state.user);
    const location = useLocation();
    const [view, setView] = useState('landing'); // landing, reason, thankyou, error, already_unsubscribed
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedReason, setSelectedReason] = useState('');
    const [otherReason, setOtherReason] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const emailParam = params.get('email');
        const tokenParam = params.get('token');

        if (!emailParam || !tokenParam) {
            setView('error');
            setMessage('Invalid unsubscribe link. Missing email or security token.');
        } else {
            setEmail(emailParam);
            setToken(tokenParam);
        }
    }, [location.search]);

    const handleUnsubscribe = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, token }),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.message === 'ALREADY_UNSUBSCRIBED') {
                    setView('already_unsubscribed');
                } else {
                    setView('reason');
                    toast.success('Successfully unsubscribed');
                }
            } else {
                setView('error');
                setMessage(data.message || 'Failed to unsubscribe. The link might be expired or invalid.');
            }
        } catch (error) {
            setView('error');
            setMessage('A network error occurred. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitReason = async (e) => {
        e.preventDefault();
        const reasonObj = reasons.find(r => r.id === selectedReason);
        const reasonText = selectedReason === 'other' ? otherReason : (reasonObj ? reasonObj.label : selectedReason);

        if (!reasonText && selectedReason !== '') {
            toast.info('Please enter details for "Other"');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/submit-unsubscribe-reason`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, token, reason: reasonText }),
            });

            if (res.ok) {
                setView('thankyou');
                toast.success('Feedback received. Thank you!');
            } else {
                // Even if reason submission fails, they are already unsubscribed
                setView('thankyou');
            }
        } catch (error) {
            setView('thankyou');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl w-full relative z-10"
            >
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-[2.5rem] shadow-2xl p-8 md:p-12 overflow-hidden relative">

                    <AnimatePresence mode="wait">
                        {view === 'landing' && (
                            <motion.div
                                key="landing"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center"
                            >
                                <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 transform rotate-12 transition-transform hover:rotate-0 duration-500">
                                    <FaEnvelopeOpenText className="text-5xl text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                                    Unsubscribe from <span className="text-emerald-600 dark:text-emerald-400">Emails</span>
                                </h1>

                                {email && (
                                    <div className="mb-6 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 max-w-full truncate">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                                        <span className="truncate">{email}</span>
                                    </div>
                                )}

                                <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-sm mx-auto">
                                    We're sorry to see you go. If you're sure you want to unsubscribe from our promotional emails, please click the button below.
                                </p>

                                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-4 text-sm text-slate-500 dark:text-slate-500 mb-8 border border-slate-200/50 dark:border-slate-700/50">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">Note:</span> You will still receive essential account-related emails like OTPs, password resets and reports (if any).
                                </div>

                                <DragSlider 
                                    onConfirm={handleUnsubscribe}
                                    loading={loading}
                                />
                            </motion.div>
                        )}

                        {view === 'reason' && (
                            <motion.div
                                key="reason"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                                        <FaCheckCircle className="text-3xl text-white" />
                                    </div>
                                    <div className="text-left">
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Success!</h2>
                                        <p className="text-slate-600 dark:text-slate-400">You've been successfully unsubscribed.</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 mb-8">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                        Why are you leaving? <span className="text-xs font-normal text-slate-400">(Optional)</span>
                                    </h3>

                                    <form onSubmit={handleSubmitReason} className="space-y-3">
                                        {reasons.map((reason) => (
                                            <motion.label
                                                whileTap={{ scale: 0.98 }}
                                                key={reason.id}
                                                className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer group ${selectedReason === reason.label || selectedReason === reason.id
                                                    ? 'bg-emerald-500/5 border-emerald-500 ring-4 ring-emerald-500/10'
                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="reason"
                                                    value={reason.id}
                                                    checked={selectedReason === reason.id}
                                                    onChange={() => setSelectedReason(reason.id)}
                                                    className="hidden"
                                                />
                                                <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-all flex-shrink-0 ${selectedReason === reason.id
                                                    ? 'border-emerald-500 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400 shadow-md shadow-emerald-500/20'
                                                    : 'border-slate-300 dark:border-slate-600 bg-transparent'
                                                    }`}>
                                                    {selectedReason === reason.id && (
                                                        <motion.div 
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="w-2 h-2 bg-white dark:bg-slate-950 rounded-full"
                                                        />
                                                    )}
                                                </div>
                                                <span className={`font-medium transition-colors text-left ${selectedReason === reason.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                                                    }`}>
                                                    {reason.label}
                                                </span>
                                            </motion.label>
                                        ))}

                                        {selectedReason === 'other' && (
                                            <motion.textarea
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-slate-700 dark:text-white transition-all min-h-[100px]"
                                                placeholder="Tell us more..."
                                                value={otherReason}
                                                onChange={(e) => setOtherReason(e.target.value)}
                                            />
                                        )}

                                        <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                            <button
                                                type="submit"
                                                disabled={loading || !selectedReason}
                                                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                            >
                                                {loading ? 'Submitting...' : 'Submit Feedback'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setView('thankyou')}
                                                className="px-8 py-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all"
                                            >
                                                Skip
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {view === 'thankyou' && (
                            <motion.div
                                key="thankyou"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center"
                            >
                                <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/40">
                                    <FaCheckCircle className="text-5xl text-white" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">You're All Set!</h2>
                                <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
                                    Your preferences have been updated. We'll miss having you in our promotional list, but we respect your inbox!
                                </p>
                                <Link
                                    to={currentUser ? (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin' : '/user') : '/'}
                                    className="flex items-center justify-center gap-3 w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <FaHome className="text-xl" />
                                    Return to Homepage
                                </Link>
                            </motion.div>
                        )}

                        {view === 'error' && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center"
                            >
                                <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                                    <FaExclamationCircle className="text-5xl text-rose-500" />
                                </div>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Invalid Link</h1>
                                <p className="text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
                                    {message || 'This unsubscribe link is either expired or invalid. Please check your latest email from UrbanSetu.'}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Link
                                        to={currentUser ? (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin' : '/user') : '/'}
                                        className="flex items-center justify-center gap-2 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all"
                                    >
                                        <FaHome />
                                        Home
                                    </Link>
                                    <Link
                                        to="/sign-in"
                                        className="flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all"
                                    >
                                        Sign In
                                    </Link>
                                </div>
                            </motion.div>
                        )}

                        {view === 'already_unsubscribed' && (
                            <motion.div
                                key="already_unsubscribed"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center"
                            >
                                <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                                    <FaInfoCircle className="text-5xl text-blue-600 dark:text-blue-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                                    Your contact details were previously removed from our database, effectively unsubscribing you from our communications.
                                </h2>
                                <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed font-medium">
                                    No further action is required.
                                </p>
                                <Link
                                    to={currentUser ? (currentUser.role === 'admin' || currentUser.role === 'rootadmin' ? '/admin' : '/user') : '/'}
                                    className="flex items-center justify-center gap-3 w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <FaHome className="text-xl" />
                                    Return to Homepage
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer Info */}
                    <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-500 font-medium">
                            © {new Date().getFullYear()} UrbanSetu
                        </p>
                        <div className="flex gap-6">
                            <Link to="/privacy" className="text-sm text-slate-400 hover:text-emerald-500 transition-colors">Privacy</Link>
                            <Link to="/terms" className="text-sm text-slate-400 hover:text-emerald-500 transition-colors">Terms</Link>
                            <Link to={currentUser && (currentUser.role === 'admin' || currentUser.role === 'rootadmin') ? '/support' : '/contact'} className="text-sm text-slate-400 hover:text-emerald-500 transition-colors">Support</Link>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Floaties */}
            <motion.div
                animate={{
                    y: [0, -20, 0],
                    rotate: [0, 10, 0]
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute top-1/4 left-10 text-emerald-500/20 text-6xl opacity-30 select-none pointer-events-none"
            >
                <FaPaperPlane />
            </motion.div>
            <motion.div
                animate={{
                    y: [0, 20, 0],
                    rotate: [0, -10, 0]
                }}
                transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute bottom-1/4 right-10 text-blue-500/20 text-6xl opacity-30 select-none pointer-events-none"
            >
                <FaEnvelopeOpenText />
            </motion.div>
        </div>
    );
}
