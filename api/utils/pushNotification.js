import axios from 'axios';
import User from '../models/user.model.js';

/**
 * Send a native push notification via Expo
 * @param {string} userId - ID of the user to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
export const sendPushNotification = async (userId, title, body, data = {}) => {
    try {
        const user = await User.findById(userId).select('settings');
        if (!user || !user.settings?.pushNotifications || !user.settings?.pushTokens?.length) {
            return;
        }

        const validTokens = user.settings.pushTokens;
        const messages = [];

        for (const tokenObj of validTokens) {
            const pushToken = tokenObj.token;

            // Verify if it's a valid Expo push token
            if (!pushToken.includes('ExponentPushToken') && !pushToken.includes('ExpoPushToken')) {
                continue;
            }

            // Build a Premium Notification Payload
            messages.push({
                to: pushToken,
                sound: user.settings.notificationSound === 'none' ? null : 'default',
                title: `✨ ${title}`, // Premium prefix
                body: body,
                data: {
                    ...data,
                    userId,
                    click_action: 'UrbanSetu_Notification', // Custom action link
                },
                priority: 'high',
                channelId: 'default', // Matches Android channel
                subtitle: 'UrbanSetu Alert', // Premium detail
                badge: 1,
                _displayInForeground: true, // Quality UX
            });
        }

        if (messages.length === 0) return;

        // Send multi-cast to Expo
        const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
        });

        // Handle Errors / Cleanup stale tokens
        const results = response.data?.data;
        if (Array.isArray(results)) {
            for (let i = 0; i < results.length; i++) {
                if (results[i].status === 'error' && results[i].details?.error === 'DeviceNotRegistered') {
                    const staleToken = messages[i].to;
                    console.log(`🧹 Removing stale token for user ${userId}: ${staleToken}`);
                    await User.findByIdAndUpdate(userId, {
                        $pull: { 'settings.pushTokens': { token: staleToken } }
                    });
                }
            }
        }

        return response.data;
    } catch (error) {
        console.error('Error sending push notification:', error.message);
    }
};
