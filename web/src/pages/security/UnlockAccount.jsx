import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaUnlock, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import UrbanSetuSpinner from '../../components/UrbanSetuSpinner';
import ContactSupportWrapper from '../../components/ContactSupportWrapper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function UnlockAccount() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing');
    const [message, setMessage] = useState('Verifying security token...');

    useEffect(() => {
        const unlockAccount = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/unlock-account`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (res.ok) {
                    setStatus('success');
                    setMessage(data.message || 'Account successfully unlocked.');
                } else {
                    setStatus('error');
                    setMessage(data.message || 'Invalid or expired unlock token.');
                }
            } catch (error) {
                setStatus('error');
                setMessage('An unexpected error occurred. Please try again or contact support.');
                console.error("Unlock error:", error);
            }
        };

        if (token) {
            unlockAccount();
        } else {
            setStatus('error');
            setMessage('No token provided.');
        }
    }, [token]);

    return (
        <div className="min-h-screen bg-transparent dark:bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative transition-colors duration-300">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 text-center border dark:border-gray-700">

                    {status === 'processing' && (
                        <div className="flex flex-col items-center">
                            <UrbanSetuSpinner size="lg" isBright={true} className="mb-4" />
                            <p className="text-lg font-medium text-gray-900 dark:text-white">{message}</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                                <FaUnlock className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Unlocked!</h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">{message}</p>
                            <button
                                onClick={() => navigate('/sign-in')}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                                Proceed to Sign In
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                                <FaExclamationTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Unlock Failed</h2>
                            <p className="text-red-500 dark:text-red-400 mb-6 font-medium">{message}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-4 italic">Please contact support if you continue to face issues.</p>
                        </div>
                    )}

                </div>
            </div>
            <ContactSupportWrapper />
        </div>
    );
}
