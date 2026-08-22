import React from 'react';

const AgentProfileSkeleton = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-12 transition-colors duration-300">
            {/* Header / Cover Skeleton */}
            <div className="bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-750 dark:to-gray-800 h-48 md:h-56 relative animate-pulse">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative h-full flex items-start pt-6">
                    <div className="h-9 w-36 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                </div>
            </div>

            {/* Main Content Card Skeleton */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-28 relative z-30">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="md:flex">
                        {/* Left Sidebar Skeleton */}
                        <div className="md:w-1/3 lg:w-[320px] bg-gray-50 dark:bg-gray-800/50 p-6 md:p-8 text-center md:text-left border-r border-gray-100 dark:border-gray-700 relative flex-shrink-0 animate-pulse">
                            {/* Avatar */}
                            <div className="w-36 h-36 md:w-48 md:h-48 rounded-2xl bg-gray-200 dark:bg-gray-700 mx-auto md:mx-0 mb-4 border-4 border-white dark:border-gray-700 shadow-md"></div>
                            
                            {/* Agency Name */}
                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mx-auto md:mx-0 mb-4"></div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-200 dark:border-gray-600 text-center space-y-2">
                                    <div className="h-6 w-12 bg-gray-200 dark:bg-gray-600 rounded mx-auto"></div>
                                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded mx-auto"></div>
                                </div>
                                <div className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-200 dark:border-gray-600 text-center space-y-2">
                                    <div className="h-6 w-12 bg-gray-200 dark:bg-gray-600 rounded mx-auto"></div>
                                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded mx-auto"></div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <div className="h-12 w-full bg-blue-200 dark:bg-blue-900/40 rounded-xl"></div>
                                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                            </div>
                        </div>

                        {/* Right Main Content Skeleton */}
                        <div className="md:w-2/3 lg:flex-1 p-6 md:p-10 space-y-8 animate-pulse">
                            {/* Header */}
                            <div className="space-y-2">
                                <div className="h-5 w-28 bg-blue-100 dark:bg-blue-900/30 rounded-full"></div>
                                <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                <div className="h-4 w-44 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>

                            {/* About Section */}
                            <div className="space-y-3 pt-2">
                                <div className="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded border-b dark:border-gray-700 pb-2"></div>
                                <div className="space-y-2">
                                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700/60 rounded"></div>
                                    <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700/60 rounded"></div>
                                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700/60 rounded"></div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="space-y-3 pt-2">
                                <div className="h-6 w-44 bg-gray-200 dark:bg-gray-700 rounded border-b dark:border-gray-700 pb-2"></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                            <div className="space-y-1.5 flex-1">
                                                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Active Listings Horizontal Slider Skeleton */}
                            <div className="space-y-4 pt-2">
                                <div className="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded border-b dark:border-gray-700 pb-2"></div>
                                <div className="flex gap-6 overflow-hidden">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-[280px] shrink-0 bg-gray-100 dark:bg-gray-750 rounded-2xl p-3 space-y-3 border border-gray-200 dark:border-gray-700">
                                            <div className="h-40 w-full bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                                            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            <div className="h-5 w-1/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Reviews Skeleton */}
                            <div className="space-y-4 pt-2">
                                <div className="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded border-b dark:border-gray-700 pb-2"></div>
                                {[1, 2].map(i => (
                                    <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                            <div className="space-y-1">
                                                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            </div>
                                        </div>
                                        <div className="h-3.5 w-full bg-gray-200 dark:bg-gray-700/50 rounded"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentProfileSkeleton;
