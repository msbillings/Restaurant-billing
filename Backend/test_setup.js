import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const userSchema = new mongoose.Schema({ username: String });
const User = mongoose.model('User', userSchema);

async function test() {
  try {
    const baseUri = process.env.MONGO_URI;
    console.log('Connecting to base URI...', baseUri.substring(0, 20));
    await mongoose.connect(baseUri);
    console.log('Connected.');
    
    console.log('Disconnecting...');
    await mongoose.disconnect();
    
    const parts = baseUri.split('?');
    const connectionPart = parts[0];
    const queryPart = parts.length > 1 ? `?${parts[1]}` : '';
    const lastSlashIndex = connectionPart.lastIndexOf('/');
    const newUri = connectionPart.substring(0, lastSlashIndex) + '/client_grandfeast_xyz' + queryPart;
    
    console.log('Reconnecting to', newUri.substring(0, 20));
    await mongoose.connect(newUri);
    
    console.log('Counting users...');
    const count = await User.countDocuments();
    console.log('User count:', count);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
test();
