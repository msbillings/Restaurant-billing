import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic route to check if server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'SuperAdmin Server Online', version: '1.0.0' });
});

app.get('/api/debug', (req, res) => {
  res.json({
    hasMongoUri: !!process.env.MONGODB_URI,
    nodeEnv: process.env.NODE_ENV,
    uriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 10) : null
  });
});

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restopos_superadmin');
    isConnected = true;
    console.log('Connected to SuperAdmin Database');
  } catch (err) {
    console.error('Database connection error:', err);
  }
};

if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, '0.0.0.0', () => console.log(`SuperAdmin Server running on 0.0.0.0:${PORT}`));
  });
} else {
  // Connect to DB for serverless environment BEFORE hitting routes
  app.use(async (req, res, next) => {
    await connectDB();
    next();
  });
}

// Import and use routes
import clientRoutes from './routes/clientRoutes.js';
import razorpayRoutes from './routes/razorpayRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

app.use('/api/clients', clientRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/payment', paymentRoutes);

export default app;
