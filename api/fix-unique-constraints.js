import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/user.model.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const fixUniqueConstraints = async () => {
  try {
    console.log("Starting unique constraint fix...");

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    // Check for duplicate emails
    const emailMap = new Map();
    const duplicateEmails = [];

    users.forEach(user => {
      if (emailMap.has(user.email)) {
        duplicateEmails.push({
          existing: emailMap.get(user.email),
          duplicate: user
        });
      } else {
        emailMap.set(user.email, user);
      }
    });

    // Check for duplicate mobile numbers
    const mobileMap = new Map();
    const duplicateMobiles = [];

    users.forEach(user => {
      if (mobileMap.has(user.mobileNumber)) {
        duplicateMobiles.push({
          existing: mobileMap.get(user.mobileNumber),
          duplicate: user
        });
      } else {
        mobileMap.set(user.mobileNumber, user);
      }
    });

    console.log(`Found ${duplicateEmails.length} duplicate emails`);
    console.log(`Found ${duplicateMobiles.length} duplicate mobile numbers`);

    // Remove duplicates (keep the oldest user)
    for (const { duplicate } of duplicateEmails) {
      console.log(`Removing duplicate email user: ${duplicate.email} (ID: ${duplicate._id})`);
      await User.findByIdAndDelete(duplicate._id);
    }

    for (const { duplicate } of duplicateMobiles) {
      console.log(`Removing duplicate mobile user: ${duplicate.mobileNumber} (ID: ${duplicate._id})`);
      await User.findByIdAndDelete(duplicate._id);
    }

    // Create unique indexes
    console.log("Creating unique indexes...");
    
    // Drop existing indexes first
    try {
      await User.collection.dropIndex("email_1");
      console.log("Dropped existing email index");
    } catch (error) {
      console.log("No existing email index to drop");
    }

    try {
      await User.collection.dropIndex("mobileNumber_1");
      console.log("Dropped existing mobileNumber index");
    } catch (error) {
      console.log("No existing mobileNumber index to drop");
    }

    // Create new unique indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ mobileNumber: 1 }, { unique: true });
    
    console.log("Unique indexes created successfully");

    console.log("Unique constraint fix completed successfully!");
  } catch (error) {
    console.error("Error fixing unique constraints:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the fix
connectDB().then(() => {
  fixUniqueConstraints();
}); 