import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaTimes,
    FaThumbsUp,
    FaThumbsDown,
    FaComment,
    FaBullhorn,
    FaLock,
    FaUsers,
    FaSignInAlt,
    FaUserPlus,
    FaHeart,
    FaFlag
} from 'react-icons/fa';

export default function GuestSignInModal({
    isOpen,
    onClose,
    action = 'like',
    customTitle,
    customDescription,
    customNote
}) {
    const navigate = useNavigate();
    const location = useLocation();

    // Close on Escape key press
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const getActionDetails = () => {
        switch (action) {
            case 'like':
                return {
                    icon: <FaThumbsUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
                    title: customTitle || 'Sign in to like this post',
                    description: customDescription || 'Show appreciation for helpful discussions, recommend neighborhood insights, and engage with your local community.',
                    note: customNote || 'To keep discussions authentic and prevent automated spam, reacting to posts requires a verified UrbanSetu account.'
                };
            case 'like-blog':
                return {
                    icon: <FaHeart className="w-8 h-8 text-red-500 dark:text-red-400" />,
                    badgeBg: 'bg-red-100 dark:bg-red-900/40',
                    title: customTitle || 'Sign in to like this blog',
                    description: customDescription || 'Show appreciation for insightful articles and connect with the author and community on UrbanSetu.',
                    note: customNote || 'To maintain authentic interactions and community feedback, liking articles requires a verified account.'
                };
            case 'dislike':
                return {
                    icon: <FaThumbsDown className="w-8 h-8 text-red-500 dark:text-red-400" />,
                    badgeBg: 'bg-red-100 dark:bg-red-900/40',
                    title: customTitle || 'Sign in to react',
                    description: customDescription || 'Share your feedback with neighbors. Sign in to react and express your perspective on community discussions.',
                    note: customNote || 'To maintain constructive and respectful community discussions, reactions require a verified UrbanSetu account.'
                };
            case 'reply':
                return {
                    icon: <FaComment className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
                    title: customTitle || 'Sign in to reply',
                    description: customDescription || 'Join the conversation! Sign in to reply directly to neighbors, answer questions, and participate in local threads.',
                    note: customNote || 'To maintain a safe and supportive neighborhood environment, posting replies requires a signed-in account.'
                };
            case 'comment':
            case 'comment-blog':
                return {
                    icon: <FaComment className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
                    title: customTitle || 'Sign in to comment',
                    description: customDescription || 'Have something to contribute? Sign in to join the conversation and share your thoughts with the community.',
                    note: customNote || 'UrbanSetu is built on trust and respect. Sign in to contribute to the discussion.'
                };
            case 'report':
            case 'report-blog':
                return {
                    icon: <FaFlag className="w-8 h-8 text-red-500 dark:text-red-400" />,
                    badgeBg: 'bg-red-100 dark:bg-red-900/40',
                    title: customTitle || 'Sign in to report this article',
                    description: customDescription || 'Help us keep UrbanSetu safe, accurate, and professional. Sign in to submit moderation feedback.',
                    note: customNote || 'To prevent abuse and ensure responsible reporting, submitting reports requires a signed-in account.'
                };
            case 'rate-faq':
                return {
                    icon: <FaThumbsUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
                    title: customTitle || 'Sign in to rate this FAQ',
                    description: customDescription || 'Let us know if this answer resolved your question. Your rating helps us improve our guides for everyone.',
                    note: customNote || 'To protect community feedback accuracy and prevent automated votes, rating FAQs requires a signed-in account.'
                };
            case 'rate-article':
                return {
                    icon: <FaThumbsUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
                    title: customTitle || 'Sign in to rate this article',
                    description: customDescription || 'Was this guide helpful? Sign in to cast your vote and help us improve support documentation.',
                    note: customNote || 'To prevent automated feedback manipulation, voting on support articles requires a signed-in account.'
                };
            case 'post':
                return {
                    icon: <FaBullhorn className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
                    title: customTitle || 'Sign in to create a post',
                    description: customDescription || 'Connect with your neighborhood! Share news, organize volunteer cleanups, raise safety alerts, or discuss local property topics.',
                    note: customNote || 'All community posts are visible to residents and property seekers. Sign in to publish.'
                };
            default:
                return {
                    icon: <FaLock className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
                    title: customTitle || 'Sign in required',
                    description: customDescription || 'Sign in to unlock full interactions including liking, rating, commenting, and sharing updates.',
                    note: customNote || 'To ensure a verified, safe, and spam-free platform, interactions require a signed-in account.'
                };
        }
    };

    const { icon, badgeBg, title, description, note } = getActionDetails();

    const handleSignIn = () => {
        onClose();
        const currentPath = location.pathname + location.search;
        navigate(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
    };

    const handleSignUp = () => {
        onClose();
        const currentPath = location.pathname + location.search;
        navigate(`/sign-up?redirect=${encodeURIComponent(currentPath)}`);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 transition-all duration-300 animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-signin-modal-title"
        >
            <div className="max-w-md w-full mx-4 p-6 sm:p-8 rounded-2xl shadow-2xl border-2 border-dashed bg-white/95 dark:bg-gray-800/95 border-blue-200 dark:border-gray-600 backdrop-blur-md transition-all duration-300 relative animate-fade-in-up">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close modal"
                >
                    <FaTimes size={16} />
                </button>

                <div className="text-center">
                    {/* Action Icon Badge */}
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${badgeBg} shadow-inner transition-transform duration-300 hover:scale-105`}>
                        {icon}
                    </div>

                    {/* Title */}
                    <h3 
                        id="guest-signin-modal-title"
                        className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 leading-tight"
                    >
                        {title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                        {description}
                    </p>

                    {/* Safety / Verification Note */}
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic border-t border-dashed border-gray-200 dark:border-gray-700 pt-3 mb-6 leading-normal">
                        {note}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={handleSignIn}
                            className="px-6 py-2.5 sm:py-3 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                        >
                            <FaSignInAlt className="text-sm" />
                            <span>Sign In</span>
                        </button>
                        <button
                            onClick={handleSignUp}
                            className="px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
                        >
                            <FaUserPlus className="text-sm" />
                            <span>Create Account</span>
                        </button>
                    </div>

                    {/* Dismiss Button */}
                    <div className="mt-4">
                        <button
                            onClick={onClose}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-1 px-3 rounded cursor-pointer"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
