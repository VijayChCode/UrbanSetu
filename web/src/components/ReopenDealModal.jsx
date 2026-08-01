import React from 'react';
import { FaLockOpen, FaUndo } from 'react-icons/fa';

const ReopenDealModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col items-center mb-4 text-center">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-3">
                        <FaLockOpen className="text-3xl text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Cancel Deal & Restore Property</h3>
                    <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm">
                        Are you sure you want to cancel this deal and restore the property to <span className="font-semibold text-amber-600 dark:text-amber-400">Public (Available)</span> status?
                    </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 p-4 mb-6 rounded-r-lg">
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                        <span className="font-bold">What happens next:</span>
                        <ul className="list-disc ml-4 mt-1 space-y-1">
                            <li>Restores listing to public search & recommendations</li>
                            <li>Clears the "Under Contract" / "Sold" status lock</li>
                            <li>Resets deal status back to negotiation stage</li>
                        </ul>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 shadow-md transition-all font-bold flex items-center justify-center gap-2 text-sm"
                    >
                        <FaUndo /> Unlock & Restore
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReopenDealModal;
