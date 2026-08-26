import cron from 'node-cron';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import { getSeasonalThemesForEmail } from '../utils/seasonalEvents.js';
import { sendFestivalGreetingEmail } from '../utils/emailService.js';
import { sendPushNotification } from '../utils/pushNotification.js';

let appInstance = null;

export const processFestivalGreetings = async (app = appInstance) => {
    console.log('🎉 [Festival Greetings] Starting daily check...');
    try {
        const themes = getSeasonalThemesForEmail();

        // Filter out generic seasons if they don't have explicit email flag
        if (!themes || themes.length === 0) {
            console.log('   No specific festival today.');
            return;
        }

        const currentYear = new Date().getFullYear();
        const festivalIds = themes.map(t => t.id);
        const festivalNames = themes.map(t => t.name).join(' & ');

        console.log(`   Found festival(s): ${festivalNames} (${festivalIds.join(', ')})`);

        // Find eligible users: active status and haven't received ANY of these festival greetings this year
        const users = await User.find({
            status: 'active',
            email: { $exists: true, $ne: null },
            'festivalGreetingsSent': {
                $not: {
                    $elemMatch: {
                        year: currentYear,
                        festivalId: { $in: festivalIds }
                    }
                }
            }
        }).limit(5000); // safety cap per run

        if (users.length > 0) {
            console.log(`   Found ${users.length} users eligible for ${festivalNames} greeting.`);
        } else {
            console.log('   No eligible users found (all may have received it already).');
            return;
        }

        const notifTitle = themes.length === 1
            ? `${themes[0].icon || '🎉'} ${themes[0].greet || 'Happy ' + themes[0].name + '!'}`
            : `🎉 Special Festival Greetings: ${festivalNames}!`;

        const notifMessage = themes.map(t => `${t.icon ? t.icon + ' ' : ''}${t.desc || t.name}`).join(' • ') ||
            `Warm festival greetings and best wishes to you and your family on the joyful occasion of ${festivalNames}! From all of us at UrbanSetu.`;

        const io = app?.get?.('io');

        // Process sequentially to be gentle on mail and notification servers
        for (const user of users) {
            try {
                // 1. Send combined email
                const result = await sendFestivalGreetingEmail(user.email, user.username, themes);

                if (result.success) {
                    // 2. Update user record
                    const updates = festivalIds.map(id => ({
                        year: currentYear,
                        festivalId: id,
                        sentAt: new Date()
                    }));

                    await User.updateOne(
                        { _id: user._id },
                        {
                            $push: {
                                festivalGreetingsSent: { $each: updates }
                            }
                        }
                    );

                    // 3. Create in-app Notification for NotificationBell
                    try {
                        const inAppNotif = await Notification.create({
                            userId: user._id,
                            type: 'festival_greeting',
                            title: notifTitle,
                            message: notifMessage,
                            meta: {
                                festivalIds,
                                festivalNames,
                                category: 'festival_greeting',
                                link: '/user/home'
                            }
                        });

                        // 4. Emit real-time socket event so NotificationBell rings immediately
                        if (io) {
                            io.to(user._id.toString()).emit('notificationCreated', inAppNotif);
                            io.to(`user_${user._id.toString()}`).emit('newNotification', {
                                type: 'festival_greeting',
                                title: notifTitle,
                                message: notifMessage,
                                notification: inAppNotif
                            });
                        }

                        // 5. Send Mobile Push Notification if registered
                        sendPushNotification(user._id, {
                            title: notifTitle,
                            body: notifMessage,
                            category: 'festival_greeting',
                            data: {
                                type: 'festival_greeting',
                                festivalIds,
                                link: '/user/home'
                            }
                        }).catch(() => {});
                    } catch (notifErr) {
                        console.error(`   ⚠️ Failed creating in-app notification for ${user.username}:`, notifErr.message);
                    }

                    console.log(`   ✅ Sent combined ${festivalNames} greeting and in-app notification to ${user.username}`);
                } else {
                    console.warn(`   ⚠️ Failed to send (service error) to ${user.username}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed to send greeting to ${user.username}:`, err.message);
            }

            // Small delay between emails to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (error) {
        console.error('   ❌ Festival Greeting Scheduler Error:', error);
    }
};

export const startFestivalGreetingScheduler = (app) => {
    if (app) {
        appInstance = app;
    }

    // Run Daily at 9:00 AM (Asia/Kolkata timezone)
    cron.schedule('0 9 * * *', async () => {
        await processFestivalGreetings(appInstance);
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('📅 Festival Greeting scheduler started (Daily at 9:00 AM IST)');
};

export default startFestivalGreetingScheduler;

