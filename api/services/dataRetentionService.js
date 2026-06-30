import ChatHistory from '../models/chatHistory.model.js';
import MessageRating from '../models/messageRating.model.js';

/**
 * Clean up old chat data based on individual session retention settings or fallback retention period
 * @param {number} [retentionDays=null] - Optional override. If provided, overrides settings (but still protects Forever/0)
 * @returns {Object} - Cleanup results
 */
export const cleanupOldChatData = async (retentionDays = null) => {
    try {
        const now = new Date();
        let deleteQuery;

        if (retentionDays !== null && retentionDays !== undefined) {
            console.log(`Starting data retention cleanup overriding to ${retentionDays} days (excluding Forever)...`);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            deleteQuery = {
                "settings.dataRetention": { $ne: "0" },
                createdAt: { $lt: cutoffDate }
            };
        } else {
            console.log(`Starting data retention cleanup based on individual session settings...`);
            const cutoff7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            const cutoff365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

            deleteQuery = {
                $or: [
                    { "settings.dataRetention": "7", createdAt: { $lt: cutoff7 } },
                    { "settings.dataRetention": "30", createdAt: { $lt: cutoff30 } },
                    { "settings.dataRetention": "90", createdAt: { $lt: cutoff90 } },
                    { "settings.dataRetention": "365", createdAt: { $lt: cutoff365 } },
                    { 
                        $or: [
                            { "settings.dataRetention": { $exists: false } },
                            { "settings.dataRetention": null }
                        ], 
                        createdAt: { $lt: cutoff30 } // Default fallback 30 days
                    }
                ]
            };
        }

        // Find the sessions matching the delete query to clean up their ratings
        const expiredSessions = await ChatHistory.find(deleteQuery, { sessionId: 1 });
        const expiredSessionIds = expiredSessions.map(s => s.sessionId).filter(id => !!id);

        let deletedChatsCount = 0;
        let deletedRatingsCount = 0;

        if (expiredSessionIds.length > 0) {
            console.log(`Deleting ${expiredSessionIds.length} expired chat sessions and their ratings...`);
            
            // Delete expired chat sessions
            const deletedChats = await ChatHistory.deleteMany({
                sessionId: { $in: expiredSessionIds }
            });
            deletedChatsCount = deletedChats.deletedCount || 0;

            // Delete corresponding message ratings/bookmarks
            const deletedRatings = await MessageRating.deleteMany({
                sessionId: { $in: expiredSessionIds }
            });
            deletedRatingsCount = deletedRatings.deletedCount || 0;
        }

        const result = {
            deletedChats: deletedChatsCount,
            deletedRatings: deletedRatingsCount,
            retentionType: retentionDays !== null ? `override-${retentionDays}-days` : "session-specific-settings"
        };

        console.log(`Data retention cleanup completed:`, result);
        return result;
    } catch (error) {
        console.error('Data retention cleanup failed:', error);
        throw error;
    }
};

/**
 * Get data retention statistics
 * @returns {Object} - Statistics about current data
 */
export const getDataRetentionStats = async () => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const totalChats = await ChatHistory.countDocuments();
        const totalRatings = await MessageRating.countDocuments();
        
        const oldChats = await ChatHistory.countDocuments({
            createdAt: { $lt: thirtyDaysAgo }
        });
        
        const oldRatings = await MessageRating.countDocuments({
            createdAt: { $lt: thirtyDaysAgo }
        });
        
        const recentChats = await ChatHistory.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });
        
        const recentRatings = await MessageRating.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });

        // Calculate count of chats actually expired under their settings
        const cutoff7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const cutoff365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        const expiredChats = await ChatHistory.countDocuments({
            $or: [
                { "settings.dataRetention": "7", createdAt: { $lt: cutoff7 } },
                { "settings.dataRetention": "30", createdAt: { $lt: cutoff30 } },
                { "settings.dataRetention": "90", createdAt: { $lt: cutoff90 } },
                { "settings.dataRetention": "365", createdAt: { $lt: cutoff365 } },
                { 
                    $or: [
                        { "settings.dataRetention": { $exists: false } },
                        { "settings.dataRetention": null }
                    ], 
                    createdAt: { $lt: cutoff30 } 
                }
            ]
        });
        
        return {
            total: {
                chats: totalChats,
                ratings: totalRatings
            },
            old: {
                chats: oldChats,
                ratings: oldRatings
            },
            recent: {
                chats: recentChats,
                ratings: recentRatings
            },
            expired: {
                chats: expiredChats
            },
            cutoffDate: thirtyDaysAgo.toISOString()
        };
    } catch (error) {
        console.error('Failed to get data retention stats:', error);
        throw error;
    }
};

/**
 * Clean up data for a specific user based on retention settings
 * @param {string} userId - User ID to clean up data for
 * @param {number} [retentionDays=null] - Optional override. If provided, overrides settings (but still protects Forever/0)
 * @returns {Object} - Cleanup results
 */
export const cleanupUserData = async (userId, retentionDays = null) => {
    try {
        const now = new Date();
        let deleteQuery;

        if (retentionDays !== null && retentionDays !== undefined) {
            console.log(`Starting data retention cleanup for user ${userId} overriding to ${retentionDays} days (excluding Forever)...`);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            deleteQuery = {
                userId,
                "settings.dataRetention": { $ne: "0" },
                createdAt: { $lt: cutoffDate }
            };
        } else {
            console.log(`Starting data retention cleanup for user ${userId} based on session settings...`);
            const cutoff7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            const cutoff365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

            deleteQuery = {
                userId,
                $or: [
                    { "settings.dataRetention": "7", createdAt: { $lt: cutoff7 } },
                    { "settings.dataRetention": "30", createdAt: { $lt: cutoff30 } },
                    { "settings.dataRetention": "90", createdAt: { $lt: cutoff90 } },
                    { "settings.dataRetention": "365", createdAt: { $lt: cutoff365 } },
                    { 
                        $or: [
                            { "settings.dataRetention": { $exists: false } },
                            { "settings.dataRetention": null }
                        ], 
                        createdAt: { $lt: cutoff30 } // Default fallback 30 days
                    }
                ]
            };
        }

        // Find the sessions matching the delete query to clean up their ratings
        const expiredSessions = await ChatHistory.find(deleteQuery, { sessionId: 1 });
        const expiredSessionIds = expiredSessions.map(s => s.sessionId).filter(id => !!id);

        let deletedChatsCount = 0;
        let deletedRatingsCount = 0;

        if (expiredSessionIds.length > 0) {
            // Delete expired chat sessions for specific user
            const deletedChats = await ChatHistory.deleteMany({
                userId,
                sessionId: { $in: expiredSessionIds }
            });
            deletedChatsCount = deletedChats.deletedCount || 0;

            // Delete old message ratings for specific user
            const deletedRatings = await MessageRating.deleteMany({
                userId,
                sessionId: { $in: expiredSessionIds }
            });
            deletedRatingsCount = deletedRatings.deletedCount || 0;
        }

        const result = {
            userId,
            deletedChats: deletedChatsCount,
            deletedRatings: deletedRatingsCount,
            retentionType: retentionDays !== null ? `override-${retentionDays}-days` : "session-specific-settings"
        };

        console.log(`User data retention cleanup completed:`, result);
        return result;
    } catch (error) {
        console.error('User data retention cleanup failed:', error);
        throw error;
    }
};
