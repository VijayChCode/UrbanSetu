import axios from 'axios';
import User from '../models/user.model.js';
import admin from '../config/firebaseAdmin.js';

/**
 * Send a native push notification via Expo OR Firebase FCM
 * @param {string} userId - ID of the user to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} options - Optional parameters: data, imageUrl, category
 */
export const sendPushNotification = async (userId, title, body, options = {}) => {
    const { data = {}, imageUrl = null, category = 'UrbanSetu_Notification' } = options;

    try {
        const user = await User.findById(userId).select('settings');
        if (!user || !user.settings?.pushNotifications || !user.settings?.pushTokens?.length) {
            return;
        }

        // Production-scale: Check granular preferences based on category/type
        // Mapping of internal categories to user setting fields
        const categoryToSettingMap = {
            // Property related
            'property_alert': 'propertyAlerts',
            'listing_update': 'propertyAlerts',
            'watchlist_update': 'propertyAlerts',
            'admin_created_listing': 'propertyAlerts',
            'property_edited': 'propertyAlerts',
            'property_deleted': 'propertyAlerts',
            'property_reported': 'propertyAlerts',
            'property_assigned': 'propertyAlerts',
            'property_deassigned': 'propertyAlerts',
            'property_verified': 'propertyAlerts',
            'listing_unpublished': 'propertyAlerts',
            'watchlist_price_drop': 'propertyAlerts',
            'watchlist_price_update': 'propertyAlerts',
            'watchlist_property_sold': 'propertyAlerts',
            'watchlist_property_removed': 'propertyAlerts',
            'rent_new_property_available': 'propertyAlerts',

            // Booking / Appointment related
            'appointment_update': 'bookingUpdates',
            'appointment_updated': 'bookingUpdates',
            'booking_status': 'bookingUpdates',
            'appointment_booked': 'bookingUpdates',
            'admin_booked_appointment': 'bookingUpdates',
            'appointment_cancelled_by_buyer': 'bookingUpdates',
            'appointment_cancelled_by_seller': 'bookingUpdates',
            'appointment_cancelled_by_admin': 'bookingUpdates',
            'appointment_reinitiated_by_admin': 'bookingUpdates',
            'appointment_accepted_by_seller': 'bookingUpdates',
            'appointment_rejected_by_seller': 'bookingUpdates',
            'appointment_reinitiated_by_user': 'bookingUpdates',
            'refund_appeal_submitted': 'bookingUpdates',
            'appointment_request': 'bookingUpdates',

            // Rental / Financial (Under Booking Updates for now)
            'rent_payment_due': 'bookingUpdates',
            'rent_payment_reminder_3days': 'bookingUpdates',
            'rent_payment_reminder_1day': 'bookingUpdates',
            'rent_payment_overdue': 'bookingUpdates',
            'rent_payment_received': 'bookingUpdates',
            'rent_payment_failed': 'bookingUpdates',
            'rent_contract_signed': 'bookingUpdates',
            'rent_contract_expiring_soon': 'bookingUpdates',
            'rent_contract_expired': 'bookingUpdates',
            'rent_contract_terminated': 'bookingUpdates',
            'rent_move_in_reminder': 'bookingUpdates',
            'rent_move_out_reminder': 'bookingUpdates',
            'rent_escrow_released': 'bookingUpdates',
            'rent_auto_debit_enabled': 'bookingUpdates',
            'rent_auto_debit_failed': 'bookingUpdates',
            'rent_dispute_raised': 'bookingUpdates',
            'rent_dispute_updated': 'bookingUpdates',
            'rent_dispute_resolved': 'bookingUpdates',
            'rent_verification_requested': 'bookingUpdates',
            'rent_verification_approved': 'bookingUpdates',
            'rent_verification_rejected': 'bookingUpdates',
            'rent_rating_reminder': 'bookingUpdates',
            'rent_rating_received': 'bookingUpdates',
            'rent_loan_applied': 'bookingUpdates',
            'rent_loan_approved': 'bookingUpdates',
            'rent_loan_rejected': 'bookingUpdates',
            'rent_loan_disbursed': 'bookingUpdates',
            'rent_loan_emi_due': 'bookingUpdates',
            'rent_loan_defaulted': 'bookingUpdates',

            // Marketing
            'marketing': 'marketingNotifications',
            'promotion': 'marketingNotifications',
            'newsletter': 'marketingNotifications',
            'platform_update': 'marketingNotifications',
            'festival_greeting': 'marketingNotifications',

            // Community
            'community': 'communitySocial',
            'forum': 'communitySocial',
            'new_review': 'communitySocial',
            'review_reported': 'communitySocial',
            'review_rejected': 'communitySocial',
            'review_blocked': 'communitySocial',
            'community_report': 'communitySocial',
            'rent_rating_received': 'communitySocial',

            // Security
            'security': 'securityAlerts',
            'security_alert': 'securityAlerts',
            'auth': 'securityAlerts',
            'client_error_report': 'securityAlerts',
            'video_issue_report': 'securityAlerts',
            'admin_report': 'securityAlerts',

            // Chat
            'chat': 'chatMessages',
            'message': 'chatMessages',
            'chat_message': 'chatMessages',
            'admin_message': 'chatMessages'
        };

        const userSettingField =
            categoryToSettingMap[category?.toLowerCase()] ||
            categoryToSettingMap[data?.type?.toLowerCase()] ||
            categoryToSettingMap[options.category?.toLowerCase()] ||
            categoryToSettingMap[options.type?.toLowerCase()];

        if (userSettingField && user.settings[userSettingField] === false) {
            console.log(`🚫 Notification for user ${userId} skipped due to setting: ${userSettingField}`);
            return;
        }

        const validTokens = user.settings.pushTokens;
        const expoMessages = [];
        const fcmTokens = [];

        const { actions = [] } = options; // Actions: [{ title: 'Accept', identifier: 'accept' }]

        // Map category to Android System Channels
        const getChannelId = (cat) => {
            const setting = categoryToSettingMap[cat?.toLowerCase()];
            if (setting === 'chatMessages') return 'messages';
            if (setting === 'bookingUpdates') return 'bookings';
            if (setting === 'propertyAlerts') return 'property';
            if (setting === 'securityAlerts') return 'security';
            if (setting === 'marketingNotifications') return 'marketing';
            return 'default';
        };

        const channelId = getChannelId(category) || getChannelId(data?.type) || getChannelId(options.type) || 'default';

        for (const tokenObj of validTokens) {
            const pushToken = tokenObj.token;

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
                        click_action: category,
                        imageUrl, // Include image in data for frontend handling if needed
                        actions,
                    },
                    // Category ID links to frontend-defined notification categories for actions
                    ...(category && { categoryId: category }),
                    // Rich media for Expo
                    ...(imageUrl && {
                        mutableContent: true,
                        attachments: [{ url: imageUrl }]
                    }),
                    priority: 'high',
                    channelId: channelId,
                    subtitle: 'UrbanSetu',
                    badge: 1,
                    _displayInForeground: true,
                });
            } else {
                fcmTokens.push(pushToken); // Standard Android FCM token
            }
        }

        let totalSuccesses = 0;

        // 1. Send via Expo
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

        // 2. Send via Native FCM
        if (fcmTokens.length > 0 && admin.apps?.length > 0) {
            try {
                const fcmMessage = {
                    tokens: fcmTokens,
                    notification: {
                        title: `✨ ${title}`,
                        body: body,
                        ...(imageUrl && { imageUrl: imageUrl }) // Rich image for native Android
                    },
                    data: {
                        click_action: category,
                        userId: String(userId),
                        ...(imageUrl && { notification_image: imageUrl }),
                        ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: user.settings.notificationSound === 'none' ? undefined : 'default',
                            channelId: channelId,
                            clickAction: category,
                            imageUrl: imageUrl || undefined,
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                'mutable-content': 1,
                                category: category,
                                sound: 'default'
                            }
                        },
                        fcm_options: {
                            image: imageUrl || undefined
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

/**
 * Broadcast a push notification to ALL users who have push tokens.
 * Used for system-wide events like app update releases.
 * @param {string} title
 * @param {string} body
 * @param {object} options - data, imageUrl, category, type
 */
export const sendBroadcastPushNotification = async (title, body, options = {}) => {
    const { data = {}, imageUrl = null, category = 'platform_update' } = options;

    try {
        // Fetch all users that have at least one push token and have push notifications enabled
        const users = await User.find(
            {
                'settings.pushNotifications': true,
                'settings.pushTokens.0': { $exists: true },
            },
            'settings.pushTokens settings.notificationSound settings.marketingNotifications'
        ).lean();

        if (!users || users.length === 0) {
            console.log('📢 Broadcast: No users with push tokens found');
            return { success: true, sent: 0 };
        }

        // Collect ALL tokens across all users (respect marketingNotifications opt-out)
        const expoTokens = [];
        const fcmTokens = [];

        for (const user of users) {
            // Respect user's marketing/platform_update preference
            if (user.settings?.marketingNotifications === false) continue;

            for (const tokenObj of (user.settings?.pushTokens || [])) {
                const t = tokenObj.token;
                if (!t || typeof t !== 'string') continue;
                if (t.includes('ExponentPushToken') || t.includes('ExpoPushToken')) {
                    expoTokens.push({ token: t, sound: user.settings?.notificationSound });
                } else {
                    fcmTokens.push(t);
                }
            }
        }

        let totalSuccesses = 0;
        const CHUNK = 100; // Expo limit per request

        // ── Send to Expo tokens in chunks ──────────────────────────────────────
        for (let i = 0; i < expoTokens.length; i += CHUNK) {
            const chunk = expoTokens.slice(i, i + CHUNK);
            const messages = chunk.map(({ token, sound }) => ({
                to: token,
                sound: sound === 'none' ? null : 'default',
                title: `✨ ${title}`,
                body,
                data: { ...data, click_action: category },
                ...(category && { categoryId: category }),
                priority: 'high',
                channelId: 'default',
                badge: 1,
                _displayInForeground: true,
            }));
            try {
                const res = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                });
                const results = res.data?.data;
                if (Array.isArray(results)) {
                    totalSuccesses += results.filter(r => r.status !== 'error').length;
                }
            } catch (expoErr) {
                console.error('Broadcast Expo chunk error:', expoErr.message);
            }
        }

        // ── Send to native FCM tokens ──────────────────────────────────────────
        if (fcmTokens.length > 0 && admin.apps?.length > 0) {
            for (let i = 0; i < fcmTokens.length; i += 500) {
                const chunk = fcmTokens.slice(i, i + 500);
                try {
                    const fcmRes = await admin.messaging().sendEachForMulticast({
                        tokens: chunk,
                        notification: { title: `✨ ${title}`, body },
                        data: { click_action: category, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) },
                        android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } },
                        apns: { payload: { aps: { sound: 'default' } } },
                    });
                    totalSuccesses += fcmRes.successCount;
                } catch (fcmErr) {
                    console.error('Broadcast FCM chunk error:', fcmErr.message);
                }
            }
        }

        console.log(`📢 Broadcast sent: ${totalSuccesses} / ${expoTokens.length + fcmTokens.length} devices`);
        return { success: true, sent: totalSuccesses, total: expoTokens.length + fcmTokens.length };
    } catch (error) {
        console.error('Error in sendBroadcastPushNotification:', error.message);
        return { success: false, error: error.message };
    }
};

