import React from 'react';

const SecurityIntelligenceSkeleton = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 md:px-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto animate-pulse">
                {/* Header Skeleton */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-64 mb-2"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-96"></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-32"></div>
                        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    </div>
                </div>

                {/* Summary Cards Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {[1, 2, 3].map((_, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
                            <div className="h-14 w-14 rounded-2xl bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-24 mb-2"></div>
                                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-16"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Analytics Section Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 mb-6"></div>
                        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-full w-64 mx-auto"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4 mx-auto mt-6"></div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 mb-6"></div>
                        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg w-full"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4 mx-auto mt-6"></div>
                    </div>
                </div>

                {/* Table Section Skeleton */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 dark:border-gray-700 gap-4">
                        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-2xl w-full md:w-1/2"></div>
                        <div className="flex items-center gap-2">
                            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-24"></div>
                            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-24"></div>
                        </div>
                    </div>
                    <div className="p-6">
                        {[1, 2, 3, 4, 5].map((_, index) => (
                            <div key={index} className="flex justify-between items-center py-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-32"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-16"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityIntelligenceSkeleton;
