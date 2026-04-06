import React from "react";
import { FaTrophy } from "react-icons/fa";
import { usePageTitle } from "../hooks/usePageTitle";
import CommunityLeaderboard from "../components/SetuCoins/CommunityLeaderboard";

export default function Leaderboard({ isAdmin = false }) {
    usePageTitle(isAdmin ? "Admin - Community Leaderboard" : "Community Leaderboard - Top Earners");

    return (
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 min-h-screen py-10 px-4 md:px-8">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-3 flex items-center justify-center gap-3">
                        <FaTrophy className="text-yellow-500" /> Community Leaderboard
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">
                        See who's leading the SetuCoins race! Earn coins to climb the ranks.
                    </p>
                </div>

                {/* Shared Reusable Component */}
                <CommunityLeaderboard
                    limit={isAdmin ? 50 : 10}
                    showHeader={true}
                    showYourStatus={!isAdmin}
                    isAdmin={isAdmin}
                />

                {!isAdmin && (
                    <div className="mt-12 text-center">
                        <p className="text-slate-400 text-sm font-medium">
                            Want to see your name here?
                            <a href="/user/rewards" className="text-indigo-600 hover:underline ml-1 font-bold">Earn more SetuCoins</a>
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}
