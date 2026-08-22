import React from 'react';

export const AgentCardSkeleton = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col animate-pulse">
            {/* Header / Cover */}
            <div className="h-24 bg-gray-200 dark:bg-gray-700"></div>

            <div className="px-5 pt-0 pb-5 relative flex-grow flex flex-col">
                {/* Avatar & Rating Header */}
                <div className="relative -mt-12 mb-3 flex justify-between items-end">
                    <div className="w-22 h-22 rounded-2xl bg-gray-300 dark:bg-gray-600 border-4 border-white dark:border-gray-800 shadow-md"></div>
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>

                {/* Info */}
                <div className="space-y-2.5 mb-4">
                    <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>

                    {/* Badges */}
                    <div className="flex gap-2 pt-1">
                        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                </div>

                {/* Button */}
                <div className="mt-auto pt-2">
                    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>
            </div>
        </div>
    );
};

const FindAgentSkeleton = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-12 transition-colors duration-300">
            {/* Hero Section Skeleton */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 py-10 md:py-14 animate-pulse">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
                    <div className="h-9 w-64 bg-white/20 rounded-lg mx-auto"></div>
                    <div className="h-4 w-96 max-w-full bg-white/15 rounded mx-auto"></div>
                    {/* Search bar skeleton */}
                    <div className="max-w-3xl mx-auto h-16 bg-white/30 rounded-2xl"></div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                {/* Header & Filter Bar Skeleton */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    </div>
                    <div className="flex gap-3">
                        <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-9 w-36 bg-blue-200 dark:bg-blue-900/40 rounded-lg"></div>
                    </div>
                </div>

                {/* Cards Grid Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <AgentCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FindAgentSkeleton;
