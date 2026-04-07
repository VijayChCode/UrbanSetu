import React from 'react';
import { 
    FaUserFriends, FaCheck, FaStar, FaHome, FaCoins, FaFire, 
    FaTrophy, FaRocket, FaGift, FaArrowUp, FaArrowDown 
} from 'react-icons/fa';

/**
 * Centrally managed theme mapping for all SetuCoin transaction sources.
 * This ensures consistency across Overview, History, and Admin views.
 */
export const GET_TRANSACTION_THEME = (source, type) => {
    const themes = {
        referral: {
            color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
            labelColor: 'text-purple-600 dark:text-purple-400',
            adminColor: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
            icon: <FaUserFriends size={14} />
        },
        profile_completion: {
            color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
            labelColor: 'text-blue-600 dark:text-blue-400',
            adminColor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
            icon: <FaCheck size={14} />
        },
        admin_adjustment: {
            color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
            labelColor: 'text-amber-600 dark:text-amber-400',
            adminColor: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
            icon: <FaStar size={14} />
        },
        rent_payment: {
            color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
            labelColor: 'text-indigo-600 dark:text-indigo-400',
            adminColor: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
            icon: <FaHome size={14} />
        },
        payment_reward: {
            color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
            labelColor: 'text-yellow-600 dark:text-yellow-400',
            adminColor: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
            icon: <FaCoins size={14} />
        },
        rent_streak_bonus: {
            color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
            labelColor: 'text-orange-600 dark:text-orange-400',
            adminColor: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
            icon: <FaFire size={14} />
        },
        monthly_leaderboard_reward: {
            color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
            labelColor: 'text-indigo-600 dark:text-indigo-400',
            adminColor: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
            icon: <FaTrophy size={14} />
        },
        signup_bonus: {
            color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
            labelColor: 'text-green-600 dark:text-green-400',
            adminColor: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
            icon: <FaRocket size={14} />
        },
        review_reward: {
            color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
            labelColor: 'text-pink-600 dark:text-pink-400',
            adminColor: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
            icon: <FaStar size={14} />
        },
        redemption_rent_fee: {
            color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
            labelColor: 'text-emerald-600 dark:text-emerald-400',
            adminColor: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
            icon: <FaHome size={14} />
        },
        redemption_coupon: {
            color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
            labelColor: 'text-rose-600 dark:text-rose-400',
            adminColor: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
            icon: <FaGift size={14} />
        }
    };

    return themes[source] || {
        color: type === 'credit' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        labelColor: 'text-slate-400 dark:text-gray-500',
        adminColor: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
        icon: type === 'credit' ? <FaArrowUp size={14} /> : <FaArrowDown size={14} />
    };
};

const TransactionThemedIcon = ({ source, type, containerClassName = "" }) => {
    const theme = GET_TRANSACTION_THEME(source, type);
    return (
        <div className={`${theme.color} ${containerClassName}`}>
            {theme.icon}
        </div>
    );
};

export default TransactionThemedIcon;
