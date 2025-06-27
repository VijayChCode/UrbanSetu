import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/user.model.js';

dotenv.config();

const checkDefaultAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb+srv://Rajashekar:Rajashekar@mern-estate.kzrjh.mongodb.net/mern-estate?retryWrites=true&w=majority&appName=mern-estate&tls=true&tlsAllowInvalidCertificates=true");
    console.log('Connected to MongoDB');

    // Check if default admin exists
    const defaultAdmin = await User.findOne({ email: 'adminvijay@gmail.com' });
    
    if (defaultAdmin) {
      console.log('✅ Default admin found:');
      console.log('Email:', defaultAdmin.email);
      console.log('Username:', defaultAdmin.username);
      console.log('Role:', defaultAdmin.role);
      console.log('Admin Approval Status:', defaultAdmin.adminApprovalStatus);
      console.log('Admin Approval Date:', defaultAdmin.adminApprovalDate);
      console.log('Admin Request Date:', defaultAdmin.adminRequestDate);
    } else {
      console.log('❌ Default admin not found!');
      console.log('Run: npm run seed-admin');
    }

    // Check all admin users
    const allAdmins = await User.find({ role: 'admin' });
    console.log('\n📋 All admin users:');
    allAdmins.forEach(admin => {
      console.log(`- ${admin.email} (${admin.adminApprovalStatus})`);
    });

  } catch (error) {
    console.error('Error checking default admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

// Run the check
checkDefaultAdmin(); 