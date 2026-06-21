import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/user.model.js';

dotenv.config();

const seedDefaultAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO);
    console.log('Connected to MongoDB');

    // Check if default admin already exists
    const existingAdmin = await User.findOne({ email: 'adminvijay@gmail.com' });
    
    if (existingAdmin) {
      console.log('Default admin already exists');
      return;
    }

    // Create default admin
    const hashedPassword = bcryptjs.hashSync('Salendra@2004', 10);
    
    const defaultAdmin = new User({
      username: 'adminvijay',
      email: 'adminvijay@gmail.com',
      password: hashedPassword,
      role: 'admin',
      isDefaultAdmin: true,
      adminApprovalStatus: 'approved',
      adminApprovalDate: new Date(),
      adminRequestDate: new Date()
    });

    await defaultAdmin.save();
    console.log('Default admin created successfully');
    console.log('Email: adminvijay@gmail.com');
    console.log('Password: Salendra@2004');
    console.log('Role: admin (pre-approved)');

  } catch (error) {
    console.error('Error seeding default admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the seeding function
seedDefaultAdmin(); 