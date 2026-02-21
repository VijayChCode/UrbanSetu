import React from 'react';

export default function AdminDeploymentManagementSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden animate-pulse font-sans transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-8 relative z-10">

                {/* Header Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 relative overflow-hidden transition-colors duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-3">
                            <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-5 w-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Upload Form Skeleton */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sticky top-8 transition-colors duration-300">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>

                            <div className="space-y-5">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="space-y-2">
                                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                                    </div>
                                ))}
                                <div className="h-12 w-full bg-blue-100 dark:bg-blue-900/30 rounded-xl"></div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Active & History */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Active Deployments Skeleton */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2].map(i => (
                                    <div key={i} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 h-48 flex flex-col justify-between transition-colors duration-300">
                                        <div className="flex justify-between">
                                            <div className="flex gap-3">
                                                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                                <div className="space-y-2">
                                                    <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                                </div>
                                            </div>
                                            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* All Deployments List Skeleton */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
                            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between transition-colors duration-300 gap-4">
                                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-xl hidden md:block"></div>
                                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                            </div>

                            {/* Mobile List Skeleton */}
                            <div className="md:hidden p-6 space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-gray-50 dark:bg-gray-900/50 rounded-2x border border-gray-100 dark:border-gray-700 p-5 h-56 flex flex-col justify-between">
                                        <div className="flex justify-between">
                                            <div className="flex gap-3">
                                                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                                <div className="space-y-2">
                                                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                        </div>
                                        <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl w-full"></div>
                                        <div className="flex gap-2">
                                            <div className="h-8 flex-1 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                                            <div className="h-8 flex-1 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                                            <div className="h-8 w-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table Skeleton */}
                            <div className="hidden md:block">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                            <div className="space-y-2">
                                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            </div>
                                        </div>
                                        <div className="w-32 mr-8">
                                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                                        </div>
                                        <div className="w-24 mr-8">
                                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                        </div>
                                        <div className="w-24">
                                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                                        </div>
                                        <div className="w-40 flex gap-2 justify-end">
                                            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
