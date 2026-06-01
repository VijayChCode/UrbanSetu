import React, { useState, useEffect } from 'react';
import { FaExchangeAlt, FaHistory, FaCalendarAlt, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../../utils/auth';
import TransactionThemedIcon, { GET_TRANSACTION_THEME } from './TransactionThemedIcon';

const CoinHistory = ({ initialOpen = false, refreshTrigger = 0 }) => {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(initialOpen); // Collapsible

    useEffect(() => {
        const getHistory = async () => {
            try {
                setLoading(true);
                const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/coins/history`);
                const data = await response.json();
                if (data.success) {
                    setTransactions(data.transactions);
                }
            } catch (err) {
                console.error('Failed to fetch coin history', err);
            } finally {
                setLoading(false);
            }
        };
        getHistory();
    }, [refreshTrigger]);

    const toggleOpen = () => setIsOpen(!isOpen);

    if (!isOpen) {
        return (
            <button onClick={toggleOpen} className="w-full mt-4 flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                <span className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2"><FaHistory className="text-blue-500 dark:text-blue-400" /> Transaction History</span>
                <FaChevronDown className="text-gray-400 dark:text-gray-500" />
            </button>
        )
    }

    return (
        <div className="w-full mt-4 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden animation-[fadeIn_0.3s] transition-colors duration-300">
            <div
                className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center cursor-pointer transition-colors"
                onClick={toggleOpen}
            >
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <FaHistory className="text-blue-500 dark:text-blue-400" />
                    Recent Transactions
                </h3>
                <FaChevronUp className="text-gray-400 dark:text-gray-500" />
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading history...</div>
                ) : transactions.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center text-gray-400 dark:text-gray-500">
                        <FaExchangeAlt className="text-3xl mb-2 opacity-20" />
                        <p>No transactions yet.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {transactions.map((tx) => {
                            const theme = GET_TRANSACTION_THEME(tx.source, tx.type);
                            return (
                                <li key={tx._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-start gap-3">
                                        <TransactionThemedIcon source={tx.source} type={tx.type} containerClassName="mt-1 p-2 rounded-lg" />
                                        <div>
                                            <p className="font-medium text-gray-800 dark:text-gray-100">{tx.description}</p>
                                            <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                <span className="flex items-center gap-1"><FaCalendarAlt className="text-[10px]" /> {new Date(tx.createdAt).toLocaleDateString()}</span>
                                                <span className={`px-1.5 rounded uppercase text-[10px] tracking-wider font-bold ${theme.adminColor}`}>
                                                    {tx.source.replace(/_/g, ' ')}
                                                </span>
                                                {tx.referenceId && (tx.source === 'rent_payment' || tx.source === 'payment_reward' || tx.referenceModel === 'Payment') && (
                                                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-850 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800/30">
                                                        Tx ID: {typeof tx.referenceId === 'object' ? (tx.referenceId.paymentId || tx.referenceId._id || String(tx.referenceId)) : tx.referenceId}
                                                    </span>
                                                )}
                                                {tx.type === 'credit' && tx.expiryDate && (
                                                    <span className="text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-900/20 px-1.5 rounded text-[10px] border border-orange-100 dark:border-orange-800">
                                                        Exp: {new Date(tx.expiryDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`font-bold text-lg ${tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 text-center transition-colors">
                <button
                    onClick={() => navigate('/user/rewards?tab=history')}
                    className="group inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 dark:hover:text-indigo-300 transition-all focus:outline-none"
                >
                    View All Activity
                    <FaChevronDown className="text-[10px] group-hover:translate-y-0.5 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default CoinHistory;
