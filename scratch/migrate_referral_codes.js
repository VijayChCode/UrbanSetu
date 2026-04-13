import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './api/models/user.model.js';

dotenv.config();

/**
 * Migration script to generate referral codes for all existing users
 */
async function migrateReferralCodes() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const usersWithoutCode = await User.find({
            $or: [
                { 'gamification.referralCode': { $exists: false } },
                { 'gamification.referralCode': null },
                { 'gamification.referralCode': '' }
            ]
        });

        console.log(`Found ${usersWithoutCode.length} users needing referral codes.`);

        let processed = 0;
        for (const user of usersWithoutCode) {
            // Simply saving the user triggers the pre-save hook in user.model.js
            // which generates the unique referral code.
            await user.save();
            processed++;
            if (processed % 10 === 0) {
                console.log(`Processed ${processed}/${usersWithoutCode.length} users...`);
            }
        }

        console.log('Migration complete! All users now have referral codes.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateReferralCodes();
