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
        if (!user || !user.settings?.pushNotifications || !user.settings?.pushToken) {
            return;
        }

        const pushToken = user.settings.pushToken;

        // Verify if it's a valid Expo push token
        if (!pushToken.includes('ExponentPushToken') && !pushToken.includes('ExpoPushToken')) {
            console.error('Invalid Expo push token:', pushToken);
            return;
        }

        const message = {
            to: pushToken,
            sound: user.settings.notificationSound === 'none' ? null : 'default',
            title: title,
            body: body,
            data: data,
            priority: 'high',
        };

        const response = await axios.post('https://exp.host/--/api/v2/push/send', message, {
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
        });

        if (response.data?.data?.status === 'error') {
            console.error('Expo push notification error:', response.data.data.message);

            // If the token is no longer valid, we should ideally disable push notifications for this user
            if (response.data.data.details?.error === 'DeviceNotRegistered') {
                await User.findByIdAndUpdate(userId, {
                    'settings.pushNotifications': false,
                    'settings.pushToken': null
                });
            }
        }

        return response.data;
    } catch (error) {
        console.error('Error sending push notification:', error.message);
    }
};
