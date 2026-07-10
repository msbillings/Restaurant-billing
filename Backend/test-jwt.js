import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
  const token = jwt.sign({ id: 'dummy', db: 'client_maheer_db' }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', { expiresIn: '1h' });
  console.log(token);
};
test();
