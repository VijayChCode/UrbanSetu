import React from 'react';

const PropertyOwnershipLogsSkeleton = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-pulse transition-colors duration-300 py-4 sm:py-8 px-3 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

                {/* Header Banner Skeleton */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 bg-purple-200 dark:bg-purple-900/40 rounded-xl sm:rounded-2xl flex-shrink-0"></div>
                        <div className="space-y-2">
                            <div className="h-6 w-48 sm:w-64 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                            <div className="h-3 w-64 sm:w-80 bg-gray-200 dark:bg-gray-800 rounded"></div>
                        </div>
                    </div>
                    <div className="w-full sm:w-44 h-10 bg-gray-200 dark:bg-gray-800 rounded-xl sm:rounded-2xl"></div>
                </div>

                {/* Filter Tabs & Search Bar Skeleton */}
                <div className="bg-white dark:bg-gray-900 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-full sm:w-auto">
                        <div className="h-8 w-20 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                    </div>
                    <div className="w-full sm:w-80 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl sm:rounded-2xl"></div>
                </div>

                {/* Content Table / Cards Skeleton */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    
                    {/* Mobile Cards Skeleton */}
                    <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="h-5 w-24 bg-purple-200 dark:bg-purple-900/40 rounded-full"></div>
                                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="h-4 w-40 bg-gray-300 dark:bg-gray-700 rounded"></div>
                                    <div className="h-3 w-28 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                </div>
                                <div className="h-16 bg-gray-50 dark:bg-gray-800/60 rounded-xl"></div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table Skeleton */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                                <tr>
                                    <th className="px-6 py-4"><div className="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded"></div></th>
                                    <th className="px-6 py-4"><div className="h-4 w-28 bg-gray-300 dark:bg-gray-700 rounded"></div></th>
                                    <th className="px-6 py-4"><div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded"></div></th>
                                    <th className="px-6 py-4"><div className="h-4 w-36 bg-gray-300 dark:bg-gray-700 rounded"></div></th>
                                    <th className="px-6 py-4"><div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div></th>
                                    <th className="px-6 py-4 text-right"><div className="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded ml-auto"></div></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4">
                                            <div className="h-6 w-24 bg-purple-100 dark:bg-purple-900/30 rounded-full"></div>
                                        </td>
                                        <td className="px-6 py-4 space-y-1.5">
                                            <div className="h-4 w-36 bg-gray-300 dark:bg-gray-700 rounded"></div>
                                            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                                                <div className="space-y-1">
                                                    <div className="h-3 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
                                                    <div className="h-2 w-12 bg-purple-200 dark:bg-purple-900/40 rounded"></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 space-y-1">
                                            <div className="h-3.5 w-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-3 w-40 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                        </td>
                                        <td className="px-6 py-4 text-right space-y-1">
                                            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-700 rounded ml-auto"></div>
                                            <div className="h-2 w-24 bg-gray-200 dark:bg-gray-800 rounded ml-auto"></div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PropertyOwnershipLogsSkeleton;
