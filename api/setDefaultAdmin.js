import mongoose from 'mongoose';
import User from './models/user.model.js';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const setDefaultAdmin = async () => {
  try {
    await connectDB();
    
    // Find the adminvijay@gmail.com user
    const defaultAdmin = await User.findOne({ email: 'adminvijay@gmail.com' });
    
    if (!defaultAdmin) {
      console.log('Default admin user not found. Please ensure adminvijay@gmail.com exists.');
      return;
    }
    
    // Set as default admin
    defaultAdmin.isDefaultAdmin = true;
    await defaultAdmin.save();
    
    console.log('Default admin set successfully for:', defaultAdmin.email);
    
    // Verify the change
    const updatedAdmin = await User.findOne({ email: 'adminvijay@gmail.com' });
    console.log('Updated admin data:', {
      email: updatedAdmin.email,
      isDefaultAdmin: updatedAdmin.isDefaultAdmin,
      role: updatedAdmin.role
    });
    
  } catch (error) {
    console.error('Error setting default admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

setDefaultAdmin(); 