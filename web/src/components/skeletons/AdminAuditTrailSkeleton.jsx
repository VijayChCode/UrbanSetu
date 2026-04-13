import React from 'react';

export default function AdminAuditTrailSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Section Skeleton */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                        <div className="space-y-2">
                            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-28 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                    </div>
                </div>

                {/* Filter Card Skeleton */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="space-y-2">
                                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Logs Table Skeleton */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <th key={i} className="px-6 py-4">
                                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded mx-auto sm:mx-0"></div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                                    <tr key={row}>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                                                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                                <div className="h-2 w-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-6 w-6 bg-gray-200 dark:bg-gray-800 rounded-full ml-auto"></div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Skeleton */}
                <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded"></div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
