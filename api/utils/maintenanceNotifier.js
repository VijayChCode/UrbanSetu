import MaintenanceNotification from '../models/maintenanceNotification.model.js';
import { sendMaintenanceRecoveryEmail } from './emailService.js';

export const checkAndSendMaintenanceNotifications = async () => {
  try {
    // If maintenance mode is active, do nothing
    if (process.env.MAINTENANCE_MODE === 'true') {
      console.log('🚧 Maintenance mode is active. Skipping notification triggers.');
      return;
    }

    // Find all pending notifications
    const pendingNotifications = await MaintenanceNotification.find({ notified: false });
    if (pendingNotifications.length === 0) {
      return;
    }

    console.log(`✉️ Found ${pendingNotifications.length} pending maintenance notifications. Triggering emails...`);

    // Send emails
    for (const record of pendingNotifications) {
      try {
        console.log(`✉️ Sending recovery email to ${record.email}...`);
        await sendMaintenanceRecoveryEmail(record.email);
        
        // Delete the record to keep DB clean and prevent duplicate sends
        await MaintenanceNotification.deleteOne({ _id: record._id });
      } catch (err) {
        console.error(`Failed to send maintenance recovery email to ${record.email}:`, err);
      }
    }

    console.log('✅ Maintenance recovery notifications processing complete.');
  } catch (error) {
    console.error('Error processing maintenance notifications on startup:', error);
  }
};
