import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const userSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const User = mongoose.model('User', userSchema);

async function test() {
  try {
    const baseUri = process.env.MONGO_URI;
    await mongoose.connect(baseUri);
    await mongoose.disconnect();
    
    const parts = baseUri.split('?');
    const connectionPart = parts[0];
    const queryPart = parts.length > 1 ? `?${parts[1]}` : '';
    const lastSlashIndex = connectionPart.lastIndexOf('/');
    const newUri = connectionPart.substring(0, lastSlashIndex) + '/client_grandfeastmulticuisinerestaurant_6a54bc' + queryPart;
    
    await mongoose.connect(newUri);
    
    const count = await User.countDocuments();
    console.log('User count:', count);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
test();
