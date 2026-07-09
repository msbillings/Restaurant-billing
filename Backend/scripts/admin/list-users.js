import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.useDb('client_maheer_db');
  const UserModel = db.model('User', User.schema);
  const users = await UserModel.find({}, { password: 0 });
  console.log("Users in client_maheer_db:");
  console.log(users);

  const mainDbUsers = await mongoose.model('User', User.schema).find({}, { password: 0 });
  console.log("Users in main db:");
  console.log(mainDbUsers);
  
  process.exit();
}
run();
