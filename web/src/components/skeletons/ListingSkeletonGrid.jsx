import React from "react";

export default function ListingSkeletonGrid({ count = 8 }) {
  const items = Array.from({ length: count });
  return (
    <>
      {items.map((_, idx) => (
        <div key={idx} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-pulse transition-colors duration-300">
          <div className="aspect-[16/10] w-full bg-gray-200 dark:bg-gray-700 transition-colors duration-300 flex items-center justify-center relative group-hover:scale-105 transition-transform duration-500">
            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 transition-colors duration-300 animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 transition-colors duration-300 animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 transition-colors duration-300 animate-pulse" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded shadow-sm w-full mt-4 transition-colors duration-300 animate-pulse" />
          </div>
        </div>
      ))}
    </>
  );
}
