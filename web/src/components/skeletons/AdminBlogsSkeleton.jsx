import React from 'react';

const AdminBlogsSkeleton = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans transition-colors duration-300">

            {/* Hero Section Skeleton */}
            <div className="bg-gray-800 dark:bg-black pb-20 pt-10 px-4 shadow-xl relative overflow-hidden transition-colors duration-300">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10">
                    <div className="mb-6 md:mb-0 text-center md:text-left space-y-3">
                        <div className="h-10 w-64 bg-gray-700 dark:bg-gray-800 rounded animate-pulse"></div>
                        <div className="h-6 w-96 bg-gray-700 dark:bg-gray-800 rounded animate-pulse"></div>
                    </div>
                    <div className="h-12 w-48 bg-gray-700 dark:bg-gray-800 rounded-xl animate-pulse"></div>
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="flex-grow max-w-7xl mx-auto px-4 w-full -mt-10 relative z-10 pb-20">

                {/* Filters Card Skeleton */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-colors duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
                        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
                        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
                        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
                    </div>
                </div>

                {/* Blogs List Skeleton */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 transition-colors duration-300">
                        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    </div>

                    {/* Table Header (Desktop) */}
                    <div className="hidden lg:flex px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 gap-4 transition-colors duration-300">
                        <div className="w-1/4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-1/6 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-1/6 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-1/6 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-1/6 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-1/12 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-1/12 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-1/12 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="p-4 lg:px-6 lg:py-4 flex flex-col lg:flex-row items-center gap-4">
                                {/* Article Info */}
                                <div className="w-full lg:w-1/4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0 animate-pulse"></div>
                                    <div className="space-y-2 flex-grow">
                                        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                        <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                    </div>
                                </div>

                                {/* Type Badge */}
                                <div className="w-full lg:w-1/6 hidden lg:block">
                                    <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                                </div>

                                {/* Category Badge */}
                                <div className="w-full lg:w-1/6 hidden lg:block">
                                    <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
                                </div>

                                {/* Property Info */}
                                <div className="w-full lg:w-1/6 hidden lg:block">
                                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                </div>

                                {/* Status Badge */}
                                <div className="w-full lg:w-1/6 flex justify-between lg:justify-center items-center">
                                    <span className="lg:hidden text-gray-400 dark:text-gray-500 text-sm">Status</span>
                                    <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                                </div>

                                {/* Views */}
                                <div className="w-full lg:w-1/12 text-center hidden lg:block">
                                    <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse"></div>
                                </div>

                                {/* Likes */}
                                <div className="w-full lg:w-1/12 text-center hidden lg:block">
                                    <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse"></div>
                                </div>

                                {/* Comments */}
                                <div className="w-full lg:w-1/12 text-center hidden lg:block">
                                    <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse"></div>
                                </div>

                                {/* Actions (Desktop) */}
                                <div className="w-full lg:w-auto flex justify-end gap-2">
                                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AdminBlogsSkeleton;
