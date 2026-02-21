import React from 'react';

export default function DownloadsSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16 animate-pulse transition-colors duration-300">
            <div className="relative z-10">
                {/* Hero Section Skeleton */}
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-800 h-6 w-48 mx-auto mb-6"></div>
                    <div className="h-12 md:h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl w-3/4 mx-auto mb-6"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-lg w-1/2 mx-auto"></div>
                </div>

                {/* Latest Release Cards Skeleton */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-xl h-[450px] flex flex-col">
                                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl mb-6"></div>
                                <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-lg w-1/2 mb-2"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-1/3 mb-8"></div>
                                <div className="mt-auto space-y-4">
                                    <div className="h-14 bg-gray-200 dark:bg-gray-800 rounded-2xl w-full"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded-full w-2/3 mx-auto"></div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 h-24"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Version History Section Skeleton */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                            <div className="space-y-2">
                                <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                            </div>
                        </div>
                        <div className="h-12 w-64 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                    </div>

                    {/* Table Skeleton (Desktop) */}
                    <div className="hidden lg:block bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="p-8 space-y-8">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-8 border-b border-gray-50 dark:border-gray-800 pb-8 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-4 w-1/4">
                                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                                        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                                    </div>
                                    <div className="w-1/4 space-y-2">
                                        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                                        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                                    </div>
                                    <div className="w-1/2 space-y-2">
                                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                                        <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                                    </div>
                                    <div className="w-32">
                                        <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
