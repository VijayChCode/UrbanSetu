import React from 'react';
import { FaTools, FaHome } from 'react-icons/fa';
import { usePageTitle } from '../hooks/usePageTitle';

const MaintenancePage = () => {
    usePageTitle("Server Under Maintenance");

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-slate-900 flex flex-col items-center justify-center p-4 text-center">
            <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12 transform transition-all hover:scale-[1.01] duration-300 border border-gray-100 dark:border-gray-700">

                {/* Icon Animation */}
                <div className="relative mb-8 flex justify-center">
                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/40 rounded-full animate-ping opacity-20"></div>
                    <div className="relative bg-gradient-to-tr from-blue-600 to-purple-600 p-6 rounded-full shadow-lg">
                        <FaTools className="text-4xl text-white animate-pulse" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 p-2 rounded-full border-4 border-white dark:border-gray-800 shadow-md">
                        <FaHome className="text-xl text-white" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 dark:text-white mb-4 tracking-tight">
                    Server Under Maintenance
                </h1>

                {/* Real Estate Themed Message */}
                <div className="space-y-4 mb-8">
                    <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                        Building a Better Experience...
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                        We're currently renovating our digital infrastructure to serve you better. Just like a prime property, quality takes time. We'll be back online shortly to help you find your dream space.
                    </p>

                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                        Thank you for your patience!
                    </p>
                </div>

                {/* Footer/Status */}
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                        System Status: Maintenance Mode
                    </div>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-2">
                        UrbanSetu &copy; {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MaintenancePage;
