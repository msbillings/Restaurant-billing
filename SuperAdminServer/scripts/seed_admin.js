import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check if admin exists
    const adminExists = await Admin.findOne({ email: 'admin@msbilling.in' });
    if (adminExists) {
      console.log('Admin already exists!');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Maheer@123', salt);

    const newAdmin = new Admin({
      name: 'Maheer',
      email: 'admin@msbilling.in',
      password: hashedPassword,
      role: 'SuperAdmin'
    });

    await newAdmin.save();
    console.log('✅ Super Admin created successfully!');
    console.log('Email: admin@msbilling.in');
    console.log('Password: Maheer@123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
