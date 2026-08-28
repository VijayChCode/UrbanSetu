# Verification Reminder Scheduler - Integration Guide

## Overview
The verification reminder scheduler automatically sends emails to property owners who haven't completed verification for their listings.

## Schedule
- **Frequency:** Daily at 9:00 AM IST
- **Reminder Days:** 1, 3, 7, 14 days after property creation
- **Timezone:** Asia/Kolkata (IST)

## Integration Steps

### 1. Install Required Package (if not already installed)
```bash
cd api
npm install node-cron
```

### 2. Import Scheduler in Server File

Add to your main server file (e.g., `api/index.js` or `api/server.js`):

```javascript
import { startVerificationReminderScheduler } from './schedulers/verificationReminder.js';
```

### 3. Start Scheduler After Server Initialization

Add after your server starts listening:

```javascript
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start verification reminder scheduler
  startVerificationReminderScheduler();
});
```

### Complete Example

```javascript
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { startVerificationReminderScheduler } from './schedulers/verificationReminder.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ... your middleware and routes ...

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      
      // Start verification reminder scheduler
      startVerificationReminderScheduler();
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
```

## Testing

### Manual Test (Without Waiting for Cron)

Create a test file `api/test/testVerificationReminder.js`:

```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runVerificationReminderManually } from '../schedulers/verificationReminder.js';

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to database\n');
  
  await runVerificationReminderManually();
  
  await mongoose.disconnect();
  console.log('\nDisconnected from database');
  process.exit(0);
}

test();
```

Run the test:
```bash
node test/testVerificationReminder.js
```

### Check Scheduler Logs

When the scheduler runs, you'll see logs like:

```
🔔 [Verification Reminder] Starting scheduler run...
   Time: 2025-12-17T03:30:00.000Z
   Found 5 unverified listings
   ✅ Reminder sent to user@example.com (Day 1) - Beautiful Villa
   ✅ Reminder sent to owner@example.com (Day 3) - Modern Apartment
   
   📊 Summary:
      - Total unverified: 5
      - Reminders sent: 2
      - Reminders failed: 0
   ✅ Scheduler run completed
```

## Monitoring

### Check Scheduler Status

Add this endpoint to your API for monitoring:

```javascript
// api/routes/admin.routes.js
router.get('/scheduler/status', async (req, res) => {
  try {
    const unverifiedCount = await Listing.countDocuments({
      isVerified: false,
      visibility: 'private'
    });
    
    const oldestUnverified = await Listing.findOne({
      isVerified: false,
      visibility: 'private'
    }).sort({ createdAt: 1 });
    
    res.json({
      success: true,
      unverifiedListings: unverifiedCount,
      oldestUnverifiedDays: oldestUnverified 
        ? Math.floor((Date.now() - oldestUnverified.createdAt) / (1000 * 60 * 60 * 24))
        : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Troubleshooting

### Scheduler Not Running

1. **Check server logs** - Ensure you see "📅 Verification reminder scheduler started"
2. **Verify timezone** - Scheduler uses Asia/Kolkata timezone
3. **Check cron syntax** - `'30 3 * * *'` = 3:30 AM UTC = 9:00 AM IST

### Emails Not Sending

1. **Check SMTP configuration** in `.env`
2. **Verify email service** is working
3. **Check user email addresses** exist in database
4. **Review error logs** for failed sends

### Wrong Reminder Days

The scheduler sends reminders on days: **1, 3, 7, 14**

To change, edit `verificationReminder.js`:
```javascript
const reminderDays = [1, 3, 7, 14]; // Modify this array
```

## Performance Considerations

### Large Databases

If you have many unverified listings:

1. **Add pagination** to process in batches
2. **Add delay** between emails to avoid rate limits
3. **Use queue** (e.g., Bull, BullMQ) for better scaling

Example with delay:
```javascript
for (const listing of unverifiedListings) {
  await sendReminder(listing);
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
}
```

## Disabling Scheduler

To temporarily disable:

```javascript
// Comment out in server file
// startVerificationReminderScheduler();
```

Or set environment variable:
```env
ENABLE_VERIFICATION_REMINDERS=false
```

Then check in code:
```javascript
if (process.env.ENABLE_VERIFICATION_REMINDERS !== 'false') {
  startVerificationReminderScheduler();
}
```

## Email Rate Limits

Most email providers have rate limits:
- **Gmail:** 500 emails/day
- **SendGrid:** Varies by plan
- **AWS SES:** 14 emails/second (with verification)

If you hit limits:
1. Use a dedicated email service
2. Implement queuing
3. Batch emails by priority

## Next Steps

1. ✅ Integrate scheduler into server
2. ✅ Test manually first
3. ✅ Monitor logs for 24 hours
4. ✅ Adjust reminder days if needed
5. ✅ Set up monitoring dashboard

## Questions?

- **When does it run?** Daily at 9:00 AM IST
- **Who gets reminders?** Owners of unverified properties
- **How many reminders?** 4 total (days 1, 3, 7, 14)
- **Can I test it?** Yes, use `runVerificationReminderManually()`

---

# Festival Greeting Scheduler

## Overview
The festival greeting scheduler automatically sends seasonal and cultural greetings to all active users on the day of any celebration. It sends a rich HTML email, creates an in-app notification, triggers the real-time **Notification Bell** via WebSockets, and dispatches mobile push notifications.

## Schedule
- **Frequency:** Daily at **9:30 AM IST** (`30 9 * * *`)
- **Timezone:** Asia/Kolkata (IST)
- **Entry File:** `api/schedulers/festivalGreetingScheduler.js`

## Integration
In `api/index.js` inside `startServer()`:
```javascript
import { startFestivalGreetingScheduler } from './schedulers/festivalGreetingScheduler.js';

startServer = () => {
  server.listen(PORT, async () => {
    startFestivalGreetingScheduler(app);
  });
};
```
