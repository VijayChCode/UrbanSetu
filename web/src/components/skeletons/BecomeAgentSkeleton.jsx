import React from 'react';

const BecomeAgentSkeleton = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12 transition-colors duration-300 animate-pulse">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back Link Placeholder */}
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-6"></div>

                {/* Hero Header Skeleton */}
                <div className="text-center mb-10 space-y-4">
                    <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 mx-auto"></div>
                    <div className="h-9 w-72 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto"></div>
                    <div className="h-4 w-96 max-w-full bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                </div>

                {/* Main Card Skeleton */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 lg:grid-cols-3">
                        {/* Left Side Banner Skeleton */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 hidden lg:block space-y-6">
                            <div className="h-7 w-36 bg-white/20 rounded"></div>
                            <div className="space-y-6 pt-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-3">
                                        <div className="w-6 h-6 rounded-full bg-white/20 shrink-0"></div>
                                        <div className="space-y-2 flex-1">
                                            <div className="h-4 w-32 bg-white/20 rounded"></div>
                                            <div className="h-3 w-full bg-white/15 rounded"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Form Skeleton */}
                        <div className="col-span-2 p-6 lg:p-10 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="h-12 w-full bg-gray-100 dark:bg-gray-700/60 rounded-lg"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="h-12 w-full bg-gray-100 dark:bg-gray-700/60 rounded-lg"></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="h-12 w-full bg-gray-100 dark:bg-gray-700/60 rounded-lg"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="h-12 w-full bg-gray-100 dark:bg-gray-700/60 rounded-lg"></div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="h-12 w-full bg-gray-100 dark:bg-gray-700/60 rounded-lg"></div>
                            </div>

                            <div className="space-y-2">
                                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="h-28 w-full bg-gray-100 dark:bg-gray-700/60 rounded-lg"></div>
                            </div>

                            <div className="pt-2">
                                <div className="h-12 w-full bg-blue-600/60 rounded-xl"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BecomeAgentSkeleton;
