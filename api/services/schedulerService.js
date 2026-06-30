import cron from 'node-cron';
import Reminder from '../models/reminder.model.js';
import User from '../models/user.model.js';
import { sendReminderNotificationEmail } from '../utils/emailService.js';
import { checkAndSendAppointmentReminders } from './appointmentReminderService.js';
import { checkAndSendOutdatedAppointmentEmails } from './outdatedAppointmentService.js';
import { autoPurgeSoftbannedAccounts } from './autoPurgeService.js';
import { sendAccountDeletionReminders } from './accountReminderService.js';
import { checkEmailServiceStatus } from './emailMonitoringService.js';
import { cleanupOldChatData } from './dataRetentionService.js';
import { checkAndSendLoanReminders } from './loanReminderService.js';
import { checkAndSendRentReminders } from './rentReminderService.js';
import {
  checkAndSendSearchAlerts,
  checkAndSendLeaseRenewalReminders,
  checkAndSendIncompleteListingNudges
} from './engagementService.js';
import { cleanupAllStaleSessions } from '../utils/sessionManager.js';
import { publishScheduledBlogs } from '../controllers/blog.controller.js';
import { initializeCreatorFeedbackScheduler } from '../schedulers/creatorFeedbackScheduler.js';

// Schedule appointment reminders to run every day at 9:00 AM
const scheduleAppointmentReminders = () => {
  console.log('📅 Setting up appointment reminder scheduler...');

  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running scheduled appointment reminder check...');
    try {
      const result = await checkAndSendAppointmentReminders();
      console.log('✅ Scheduled appointment reminder check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled appointment reminder check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  console.log('✅ Appointment reminder scheduler set up successfully');
  console.log('📋 Schedule: Every day at 9:00 AM (Asia/Kolkata timezone)');
};

// Schedule outdated appointment emails to run every day at 8:00 AM
const scheduleOutdatedAppointmentEmails = () => {
  console.log('📅 Setting up outdated appointment email scheduler...');

  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running scheduled outdated appointment email check...');
    try {
      const result = await checkAndSendOutdatedAppointmentEmails();
      console.log('✅ Scheduled outdated appointment email check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled outdated appointment email check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  console.log('✅ Outdated appointment email scheduler set up successfully');
  console.log('📋 Schedule: Every day at 8:00 AM (Asia/Kolkata timezone)');
};

// Schedule automatic purging of softbanned accounts to run every day at 2:00 AM
const scheduleAutoPurge = () => {
  console.log('🗑️ Setting up automatic purging scheduler...');

  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Running scheduled automatic purging check...');
    try {
      const result = await autoPurgeSoftbannedAccounts();
      console.log('✅ Scheduled automatic purging check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled automatic purging check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  console.log('✅ Automatic purging scheduler set up successfully');
  console.log('📋 Schedule: Every day at 2:00 AM (Asia/Kolkata timezone)');
};

// Schedule account deletion reminders to run every day at 10:00 AM
const scheduleAccountReminders = () => {
  console.log('📧 Setting up account deletion reminder scheduler...');

  // Run every day at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('⏰ Running scheduled account deletion reminder check...');
    try {
      const result = await sendAccountDeletionReminders();
      console.log('✅ Scheduled account deletion reminder check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled account deletion reminder check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  console.log('✅ Account deletion reminder scheduler set up successfully');
  console.log('📋 Schedule: Every day at 10:00 AM (Asia/Kolkata timezone)');
};

// Schedule email service monitoring to run every 24 hours at 11:00 PM
const scheduleEmailMonitoring = (app) => {
  console.log('📧 Setting up email service monitoring scheduler...');

  // Run every 24 hours at 11:00 PM
  cron.schedule('0 23 * * *', async () => {
    console.log('⏰ Running scheduled email service monitoring check...');
    try {
      const result = await checkEmailServiceStatus(app);
      console.log('✅ Scheduled email service monitoring check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled email service monitoring check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  console.log('✅ Email service monitoring scheduler set up successfully');
  console.log('📋 Schedule: Every 24 hours at 11:00 PM (Asia/Kolkata timezone)');
};

// Schedule data retention cleanup to run every day at 3:00 AM
const scheduleDataRetentionCleanup = () => {
  console.log('🗑️ Setting up data retention cleanup scheduler...');

  // Run every day at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Running scheduled data retention cleanup...');
    try {
      const result = await cleanupOldChatData(); // Respect individual session settings
      console.log('✅ Scheduled data retention cleanup completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled data retention cleanup:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  console.log('✅ Data retention cleanup scheduler set up successfully');
  console.log('📋 Schedule: Every day at 3:00 AM (Asia/Kolkata timezone)');
};



// Schedule loan EMI reminders to run every day at 9:30 AM
const scheduleLoanReminders = () => {
  console.log('💰 Setting up loan reminder scheduler...');

  // Run every day at 9:30 AM
  cron.schedule('30 9 * * *', async () => {
    console.log('⏰ Running scheduled loan reminder check...');
    try {
      const result = await checkAndSendLoanReminders();
      console.log('✅ Scheduled loan reminder check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled loan reminder check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('✅ Loan reminder scheduler set up successfully');
  console.log('📋 Schedule: Every day at 9:30 AM (Asia/Kolkata timezone)');
};

// Schedule rent reminders to run every day at 10:30 AM
const scheduleRentReminders = () => {
  console.log('🏠 Setting up rent reminder scheduler...');

  // Run every day at 10:30 AM
  cron.schedule('30 10 * * *', async () => {
    console.log('⏰ Running scheduled rent reminder check...');
    try {
      const result = await checkAndSendRentReminders();
      console.log('✅ Scheduled rent reminder check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled rent reminder check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('✅ Rent reminder scheduler set up successfully');
  console.log('📋 Schedule: Every day at 10:30 AM (Asia/Kolkata timezone)');
};

// Schedule Engagement & Retention Jobs
const scheduleEngagementJobs = () => {
  console.log('🚀 Setting up engagement schedulers...');

  // Search Alerts: Daily at 7:00 PM
  cron.schedule('0 19 * * *', async () => {
    console.log('Running Search Alerts Check...');
    await checkAndSendSearchAlerts();
  }, { scheduled: true, timezone: "Asia/Kolkata" });

  // Lease Renewal Reminders: Daily at 11:00 AM
  cron.schedule('0 11 * * *', async () => {
    console.log('Running Lease Renewal Check...');
    await checkAndSendLeaseRenewalReminders();
  }, { scheduled: true, timezone: "Asia/Kolkata" });

  // Incomplete Listing Nudges: Daily at 6:00 PM
  cron.schedule('0 18 * * *', async () => {
    console.log('Running Incomplete Listing Nudge Check...');
    await checkAndSendIncompleteListingNudges();
  }, { scheduled: true, timezone: "Asia/Kolkata" });

  console.log('✅ Engagement schedulers set up: Alerts (7PM), Leases (11AM), Nudges (6PM)');
};

// Schedule session records cleanup to run every day at 4:00 AM
const scheduleSessionCleanup = () => {
  console.log('🧹 Setting up stale session cleanup scheduler...');

  // Run every day at 4:00 AM
  cron.schedule('0 4 * * *', async () => {
    console.log('⏰ Running scheduled stale session cleanup...');
    try {
      const result = await cleanupAllStaleSessions();
      console.log('✅ Scheduled stale session cleanup completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled stale session cleanup:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('✅ Stale session cleanup scheduler set up successfully');
  console.log('📋 Schedule: Every day at 4:00 AM (Asia/Kolkata timezone)');
};

// Schedule blog publication to run every 15 minutes
const scheduleBlogPublication = () => {
  console.log('📰 Setting up blog publication scheduler...');

  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ Running scheduled blog publication check...');
    try {
      await publishScheduledBlogs();
      console.log('✅ Scheduled blog publication check completed');
    } catch (error) {
      console.error('❌ Error in scheduled blog publication check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('✅ Blog publication scheduler set up successfully');
  console.log('📋 Schedule: Every 15 minutes');
};

// Schedule user-defined task reminders to run every minute
const scheduleUserTaskReminders = (app) => {
  console.log('📅 Setting up user task reminder scheduler (every minute)...');

  const io = app.get('io');

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const NOMINAL_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes nominal time

      // Auto-dismiss any reminders in 'triggered' status for longer than nominal time (5 minutes)
      const expiredReminders = await Reminder.find({
        status: 'triggered',
        scheduledTime: { $lt: new Date(now.getTime() - NOMINAL_EXPIRY_MS) }
      });

      if (expiredReminders.length > 0) {
        console.log(`⏰ Found ${expiredReminders.length} expired triggered reminders. Auto-dismissing...`);
        for (const reminder of expiredReminders) {
          try {
            reminder.status = 'dismissed';
            await reminder.save();
            
            // Emit socket event to notify all user sessions/tabs to stop ringing
            if (io) {
              console.log(`🗣️ Emitting reminder_dismissed (expired) for reminder ${reminder._id} to user room`);
              io.to(reminder.userId.toString()).emit('reminder_dismissed', {
                reminderId: reminder._id.toString()
              });
            }
          } catch (itemErr) {
            console.error(`Error auto-dismissing expired reminder ${reminder._id}:`, itemErr);
          }
        }
      }

      // Find all scheduled or snoozed reminders that are due
      const dueReminders = await Reminder.find({
        status: { $in: ['scheduled', 'snoozed'] },
        scheduledTime: { $lte: now }
      });

      if (dueReminders.length === 0) return;

      console.log(`⏰ Found ${dueReminders.length} due reminders. Triggering...`);

      for (const reminder of dueReminders) {
        try {
          // Update status immediately to prevent double processing in case of delays
          reminder.status = 'triggered';
          await reminder.save();

          // Fetch user details
          const user = await User.findById(reminder.userId);
          if (!user) {
            console.warn(`User ${reminder.userId} not found for reminder ${reminder._id}`);
            continue;
          }

          // Emit WebSocket event to the user's room
          if (io) {
            console.log(`🗣️ Emitting reminder_triggered to user_${user._id.toString()}: "${reminder.taskText}"`);
            io.to(user._id.toString()).emit('reminder_triggered', {
              reminderId: reminder._id.toString(),
              taskText: reminder.taskText,
              scheduledTime: reminder.scheduledTime.toISOString()
            });
          }

          // Send email notification
          if (user.email) {
            console.log(`✉️ Sending reminder email to ${user.email}`);
            await sendReminderNotificationEmail(user.email, {
              taskText: reminder.taskText,
              time: reminder.scheduledTime,
              username: user.username || user.email.split('@')[0]
            });
            reminder.emailSent = true;
            await reminder.save();
          }
        } catch (itemErr) {
          console.error(`Error processing reminder ${reminder._id}:`, itemErr);
        }
      }
    } catch (error) {
      console.error('Error in scheduled user task reminder check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('✅ User task reminder scheduler set up successfully (Asia/Kolkata timezone)');
};

// Start the scheduler
export const startScheduler = (app) => {
  console.log('🚀 Starting scheduler service...');
  scheduleAppointmentReminders();
  scheduleOutdatedAppointmentEmails();
  scheduleAutoPurge();
  scheduleAccountReminders();
  scheduleEmailMonitoring(app);
  scheduleDataRetentionCleanup();
  scheduleLoanReminders();
  scheduleRentReminders();
  scheduleEngagementJobs();
  scheduleSessionCleanup();
  scheduleBlogPublication();
  initializeCreatorFeedbackScheduler();
  scheduleUserTaskReminders(app);
  console.log('✅ Scheduler service started successfully');
};


// Stop the scheduler (for graceful shutdown)
export const stopScheduler = () => {
  console.log('🛑 Stopping scheduler service...');
  cron.getTasks().forEach(task => {
    task.destroy();
  });
  console.log('✅ Scheduler service stopped');
};
