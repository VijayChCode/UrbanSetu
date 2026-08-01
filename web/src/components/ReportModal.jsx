import React, { useState } from 'react';
import { FaTimes, FaFlag, FaExclamationTriangle } from 'react-icons/fa';

export default function ReportModal({ isOpen, onClose, onReport, title = "Report Discussion", categoriesList }) {
    const defaultCategories = [
        "Inappropriate Content",
        "Spam",
        "Harassment",
        "False Information",
        "Copyright Violation",
        "Hate Speech",
        "Other"
    ];
    const categories = categoriesList && categoriesList.length > 0 ? categoriesList : defaultCategories;

    const [reason, setReason] = useState('');
    const [category, setCategory] = useState(categories[0]);

    if (!isOpen) return null;

    const handleClose = () => {
        setReason('');
        setCategory(categories[0]);
        onClose();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        onReport(`${category}: ${reason}`, category, reason);
        handleClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-transparent dark:border-gray-700">
                <div className="bg-red-50 dark:bg-red-900/20 p-6 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                        <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-full">
                            <FaFlag className="text-xl" />
                        </div>
                        <h3 className="text-xl font-bold">{title}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg"
                        title="Close"
                    >
                        <FaTimes className="text-lg" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                        <FaExclamationTriangle className="text-amber-500 mt-1 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            Our moderators will review this discussion. Please provide details to help us understand the violation.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-gray-800 dark:text-white"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Details</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Please explain why you are reporting this..."
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all min-h-[120px] text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!reason.trim()}
                            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 shadow-lg shadow-red-200 dark:shadow-none"
                        >
                            Submit Report
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
