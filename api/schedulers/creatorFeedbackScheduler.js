import cron from 'node-cron';
import User from '../models/user.model.js';
import { sendCreatorFeedbackEmail } from '../utils/emailService.js';

/**
 * Creator Feedback Email Scheduler
 * 
 * Sends a personal feedback/welcome email from the creator of UrbanSetu
 * to users who signed up ~24 hours ago. This delay ensures:
 * - Users aren't overwhelmed with emails on signup (welcome + login + this)
 * - Users have had time to explore the platform before being asked for feedback
 * - The "we noticed you visited" message feels genuine and intentional
 * - Higher open rates compared to sending immediately with other emails
 * 
 * Schedule: Runs every 2 hours
 * Target: Users created 22-26 hours ago who haven't received this email yet
 * Batch: Max 30 users per run to avoid email rate limits
 */
export const initializeCreatorFeedbackScheduler = () => {
    // Run every 2 hours to catch users in the ~24h window
    cron.schedule('0 */2 * * *', async () => {
        console.log('💌 Running creator feedback email scheduler...');

        try {
            const now = new Date();
            // Target window: users created between 22 and 26 hours ago
            // This 4-hour overlap with the 2-hour cron ensures no user is missed
            const windowStart = new Date(now.getTime() - 26 * 60 * 60 * 1000); // 26 hours ago
            const windowEnd = new Date(now.getTime() - 22 * 60 * 60 * 1000);   // 22 hours ago

            // Find users who:
            // 1. Were created within the 22-26 hour window
            // 2. Haven't received the creator feedback email yet
            // 3. Are active (not suspended)
            // 4. Are subscribed to emails
            const eligibleUsers = await User.find({
                createdAt: { $gte: windowStart, $lte: windowEnd },
                creatorFeedbackEmailSentAt: null,
                status: 'active',
                isSubscribed: true
            })
                .select('email username createdAt')
                .limit(30); // Batch limit to avoid overwhelming email provider

            if (eligibleUsers.length === 0) {
                console.log('💌 No users eligible for creator feedback email at this time.');
                return;
            }

            console.log(`💌 Found ${eligibleUsers.length} user(s) eligible for creator feedback email.`);

            let sentCount = 0;
            let failedCount = 0;

            for (const user of eligibleUsers) {
                try {
                    const result = await sendCreatorFeedbackEmail(user.email, user.username);

                    if (result && result.success) {
                        // Mark as sent so we don't send it again
                        await User.updateOne(
                            { _id: user._id },
                            { $set: { creatorFeedbackEmailSentAt: new Date() } }
                        );
                        sentCount++;
                        console.log(`✅ Creator feedback email sent to: ${user.email}`);
                    } else {
                        failedCount++;
                        console.error(`❌ Failed to send creator feedback email to ${user.email}:`, result?.error);
                    }

                    // 1.5 second delay between emails to be gentle on the email provider
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (err) {
                    failedCount++;
                    console.error(`❌ Error processing creator feedback email for ${user.email}:`, err.message);
                }
            }

            console.log(`💌 Creator feedback email job completed. Sent: ${sentCount}, Failed: ${failedCount}`);
        } catch (error) {
            console.error('❌ Error in creator feedback email scheduler:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('✅ Creator feedback email scheduler initialized (running every 2 hours)');
};
