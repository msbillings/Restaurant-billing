import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Admin from './models/Admin.js';

dotenv.config();

const createVendor = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const email = 'vendor@passiflow.com';
    const password = 'Vendor@123';
    const name = 'Passiflow Admin';
    const vendorCompanyName = 'Passiflow Printers Ltd';

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const vendor = new Admin({
      email,
      password: hashedPassword,
      name,
      role: 'Vendor',
      vendorCompanyName
    });

    await vendor.save();
    console.log('Vendor account created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    process.exit(0);
  } catch (error) {
    console.error('Error creating vendor:', error);
    process.exit(1);
  }
};

createVendor();
