import React from 'react';

export default function LeaderboardSkeleton({ showYourStatus = false }) {
    return (
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 min-h-screen py-10 px-4 md:px-8 animate-pulse font-sans transition-colors duration-300">
            <div className="max-w-4xl mx-auto">

                {/* Header Skeleton */}
                <div className="text-center mb-10 space-y-4 flex flex-col items-center">
                    <div className="h-10 w-3/4 max-w-sm bg-gray-300 dark:bg-gray-700 rounded"></div>
                    <div className="h-6 w-1/2 max-w-md bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>

                {/* Your Status Card Skeleton */}
                {showYourStatus && (
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl p-6 border-l-8 border-indigo-600 flex flex-col md:flex-row items-center justify-between gap-6 mb-6 transition-colors duration-300">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                            <div className="space-y-2">
                                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                            </div>
                        </div>
                        <div className="w-full md:w-[180px] bg-slate-50 dark:bg-gray-700/50 px-6 py-4 rounded-3xl border border-slate-100 dark:border-gray-600 flex flex-col items-center md:items-end gap-2">
                            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    </div>
                )}

                {/* Leaderboard List Skeleton */}
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
                    {/* Table Header Mimic */}
                    <div className="p-8 bg-gray-200 dark:bg-gray-700 flex justify-between items-center h-24 mb-2 transition-colors duration-300"></div>

                    <div className="p-4 sm:p-8 space-y-4">
                        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                            <div key={i} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-900/50 transition-colors duration-300">
                                <div className="flex items-center gap-4 sm:gap-6">
                                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                    <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                                    <div className="space-y-2">
                                        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
