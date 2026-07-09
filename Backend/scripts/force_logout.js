import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_billing';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB. Logging out all users...');
        try {
            const result = await User.updateMany({}, { $set: { activeSessions: [] } });
            console.log(`Success! Logged out users. Modified count: ${result.modifiedCount}`);
        } catch (err) {
            console.error('Error logging out users:', err);
        } finally {
            await mongoose.disconnect();
            console.log('Disconnected.');
        }
    })
    .catch(err => {
        console.error('DB Connection Error:', err);
        process.exit(1);
    });
