import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/user.model.js';

dotenv.config();

const fixDefaultAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO);
    console.log('Connected to MongoDB');

    // Find and update the default admin
    const defaultAdmin = await User.findOne({ email: 'adminvijay@gmail.com' });
    
    if (defaultAdmin) {
      console.log('Found default admin, updating status...');
      
      // Update the default admin to approved status and set isDefaultAdmin true
      defaultAdmin.role = 'admin';
      defaultAdmin.isDefaultAdmin = true;
      defaultAdmin.adminApprovalStatus = 'approved';
      defaultAdmin.adminApprovalDate = new Date();
      defaultAdmin.adminRequestDate = new Date();
      
      await defaultAdmin.save();
      
      console.log('✅ Default admin updated successfully!');
      console.log('Email:', defaultAdmin.email);
      console.log('Username:', defaultAdmin.username);
      console.log('Role:', defaultAdmin.role);
      console.log('Admin Approval Status:', defaultAdmin.adminApprovalStatus);
      console.log('Admin Approval Date:', defaultAdmin.adminApprovalDate);
    } else {
      console.log('❌ Default admin not found!');
      console.log('Run: npm run seed-admin');
    }

  } catch (error) {
    console.error('Error fixing default admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

// Run the fix
fixDefaultAdmin(); 