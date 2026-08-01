import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaPaperPlane } from 'react-icons/fa';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { saleModalStore } from '../utils/saleModalStore';

const ConnectedDisputeModal = () => {
    const [state, setState] = useState(saleModalStore.get());
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        return saleModalStore.subscribe((newState) => {
            setState(newState);
        });
    }, []);

    const handleClose = () => {
        saleModalStore.close();
    };

    const handleReasonChange = (e) => {
        saleModalStore.setDisputeReason(e.target.value);
    };

    const handleSubmit = async () => {
        if (!state.id || !state.reason.trim()) return;

        setIsSubmitting(true);
        try {
            // Execute the registered callback from the parent
            await saleModalStore.executeDisputeSubmit(state.id, state.reason);
            // If successful, the modal might be closed by the parent or store logic?
            // Usually parent handles success notification.
            // We should close modal here if parent doesn't throw?
            // Actually parent logic closes it? no parent has no control over modal visibility anymore except via store.
            // So we should close it here or store should close it.
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (state.type !== 'dispute') return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6 transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                    <FaExclamationTriangle className="text-2xl" />
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Report a Dispute</h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed">
                    If you have an issue with this completed transaction (e.g., payment discrepancy, property condition), please describe it below. Our support team will investigate.
                </p>

                <textarea
                    value={state.reason}
                    onChange={handleReasonChange}
                    placeholder="Describe the issue in detail..."
                    className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none outline-none"
                ></textarea>

                <div className="flex gap-4">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !state.reason.trim()}
                        className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 shadow-md transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaPaperPlane />}
                        Submit Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConnectedDisputeModal;
