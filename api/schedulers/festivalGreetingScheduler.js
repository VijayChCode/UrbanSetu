import cron from 'node-cron';
import User from '../models/user.model.js';
import { getSeasonalThemesForEmail } from '../utils/seasonalEvents.js';
import { sendFestivalGreetingEmail } from '../utils/emailService.js';

export const startFestivalGreetingScheduler = () => {
    // Run Daily at 9:00 AM
    // Cron format: Minute Hour DayOfMonth Month DayOfWeek
    cron.schedule('0 9 * * *', async () => {
        console.log('🎉 [Festival Greetings] Starting daily check...');
        try {
            const themes = getSeasonalThemesForEmail();

            // Filter out generic seasons (like 'winter') if they don't have explicit email flag
            // although getSeasonalThemesForEmail already filters by shouldSendEmail
            if (!themes || themes.length === 0) {
                console.log('   No specific festival today.');
                return;
            }

            const currentYear = new Date().getFullYear();
            const festivalIds = themes.map(t => t.id);
            const festivalNames = themes.map(t => t.name).join(' & ');

            console.log(`   Found festival(s): ${festivalNames} (${festivalIds.join(', ')})`);

            // Find eligible users: active status and haven't received ANY of these festival greetings this year
            // This prevents sending a combined mail if they already got one part of it (e.g. if windows overlap)
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
            }

            // Process sequentially to be gentle on mail server
            for (const user of users) {
                try {
                    // Send combined email
                    const result = await sendFestivalGreetingEmail(user.email, user.username, themes);

                    if (result.success) {
                        // Update user record: Push entries for ALL festivals sent in this combined mail
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
                        console.log(`   ✅ Sent combined ${festivalNames} greeting to ${user.username}`);
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
    });

    console.log('📅 Festival Greeting scheduler started');
};

export default startFestivalGreetingScheduler;
