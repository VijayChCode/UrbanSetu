import axios from 'axios';
import User from '../models/user.model.js';
import admin from '../config/firebaseAdmin.js';

/**
 * Send a native push notification via Expo OR Firebase FCM
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
        const expoMessages = [];
        const fcmTokens = [];

        for (const tokenObj of validTokens) {
            const pushToken = tokenObj.token;

            // Notice: Native FCM device tokens don't follow the Expo format.
            // We just ensure the token isn't blank.
            if (!pushToken || typeof pushToken !== 'string') {
                continue;
            }

            // Distinguish token types (Expo vs FCM Native)
            if (pushToken.includes('ExponentPushToken') || pushToken.includes('ExpoPushToken')) {
                // Build a Premium Notification Payload for Expo
                expoMessages.push({
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
            } else {
                fcmTokens.push(pushToken); // It's a standard Android FCM ID token!
            }
        }

        let totalSuccesses = 0;

        // 1. Send via Expo (for Cloud hosted expo apps)
        if (expoMessages.length > 0) {
            try {
                const response = await axios.post('https://exp.host/--/api/v2/push/send', expoMessages, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                });

                const results = response.data?.data;
                if (Array.isArray(results)) {
                    for (let i = 0; i < results.length; i++) {
                        if (results[i].status === 'error' && results[i].details?.error === 'DeviceNotRegistered') {
                            const staleToken = expoMessages[i].to;
                            console.log(`🧹 Removing stale Expo token for user ${userId}: ${staleToken}`);
                            await User.findByIdAndUpdate(userId, {
                                $pull: { 'settings.pushTokens': { token: staleToken } }
                            });
                        } else {
                            totalSuccesses++;
                        }
                    }
                }
            } catch (expoErr) {
                console.error('Error sending Expo push notification:', expoErr.message);
            }
        }

        // 2. Send via Native FCM (for our locally compiled APK build)
        if (fcmTokens.length > 0 && admin.apps?.length > 0) {
            try {
                const fcmMessage = {
                    tokens: fcmTokens,
                    notification: {
                        title: `✨ ${title}`,
                        body: body,
                    },
                    data: {
                        // FCM requires string values ONLY for the `data` payload
                        click_action: 'UrbanSetu_Notification',
                        userId: String(userId),
                        ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: user.settings.notificationSound === 'none' ? undefined : 'default',
                            channelId: 'default', // Matches react-native-notifications setup channel
                            clickAction: 'UrbanSetu_Notification',
                        }
                    }
                };

                const fcmResponse = await admin.messaging().sendEachForMulticast(fcmMessage);

                totalSuccesses += fcmResponse.successCount;

                if (fcmResponse.failureCount > 0) {
                    const failedTokens = [];
                    fcmResponse.responses.forEach((resp, idx) => {
                        if (!resp.success &&
                            (resp.error?.code === 'messaging/invalid-registration-token' ||
                                resp.error?.code === 'messaging/registration-token-not-registered')) {
                            failedTokens.push(fcmTokens[idx]);
                        }
                    });

                    if (failedTokens.length > 0) {
                        console.log(`🧹 Removing ${failedTokens.length} stale FCM token(s) for user ${userId}`);
                        await User.findByIdAndUpdate(userId, {
                            $pull: { 'settings.pushTokens': { token: { $in: failedTokens } } }
                        });
                    }
                }
            } catch (fcmErr) {
                console.error('Error sending Native FCM push notification:', fcmErr.message);
            }
        }

        return { success: totalSuccesses > 0 };
    } catch (error) {
        console.error('Error sending push notification:', error.message);
    }
};
