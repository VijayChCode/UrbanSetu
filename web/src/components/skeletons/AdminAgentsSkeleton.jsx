import React from 'react';

const AdminAgentsSkeleton = () => {
    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="h-8 w-56 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>

                {/* Filter Tabs Skeleton */}
                <div className="flex w-full md:w-auto bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 gap-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    ))}
                </div>
            </div>

            {/* Table Container Skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                {/* Search Bar Skeleton */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="h-9 w-full md:max-w-md bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                </div>

                {/* Table Header & Rows */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50">
                                <th className="p-4"><div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
                                <th className="p-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
                                <th className="p-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
                                <th className="p-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></th>
                                <th className="p-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded ml-auto"></div></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <tr key={i}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                            <div className="space-y-2">
                                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="h-3 w-40 bg-gray-100 dark:bg-gray-800 rounded"></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="space-y-2">
                                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded"></div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    </td>
                                    <td className="p-4">
                                        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminAgentsSkeleton;
