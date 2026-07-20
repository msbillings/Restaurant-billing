import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Security Middleware Imports
import rateLimit from 'express-rate-limit';
import xssFilter from 'xss';
import hpp from 'hpp';

// 2. Limit requests from same API (Rate Limiting)
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// 3. Data sanitization against NoSQL query injection
// Custom middleware to handle Express 5 read-only properties (req.query)
import sanitizeMongo from 'mongo-sanitize';
app.use((req, res, next) => {
  try {
    if (req.body) req.body = sanitizeMongo(req.body);
    if (req.query) {
      const cleanedQuery = sanitizeMongo(req.query);
      try {
        req.query = cleanedQuery;
      } catch (err) {
        Object.defineProperty(req, 'query', {
          value: cleanedQuery,
          writable: true,
          configurable: true
        });
      }
    }
    if (req.params) {
      const cleanedParams = sanitizeMongo(req.params);
      try {
        req.params = cleanedParams;
      } catch (err) {
        Object.defineProperty(req, 'params', {
          value: cleanedParams,
          writable: true,
          configurable: true
        });
      }
    }
  } catch (error) {
    console.error('Security Sanitization Error:', error);
  }
  next();
});

// 4. Data sanitization against XSS
app.use((req, res, next) => {
  try {
    const sanitizeObject = (obj) => {
      if (!obj) return obj;
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = xssFilter(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
      return obj;
    };

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);
  } catch (error) {
    console.error('XSS Sanitization Error:', error);
  }
  next();
});

// 5. Prevent parameter pollution
app.use(hpp());

// Enforce Mongoose strict mode for queries
mongoose.set('strictQuery', true);


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
    let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restopos_superadmin';
    
    // Force connection to mscurechain where the clients are actually provisioned
    if (uri.includes('mongodb+srv')) {
      const parts = uri.split('?');
      const connectionPart = parts[0];
      const lastSlashIndex = connectionPart.lastIndexOf('/');
      uri = connectionPart.substring(0, lastSlashIndex) + '/mscurechain';
      if (parts[1]) uri += '?' + parts[1];
    }
    
    await mongoose.connect(uri);
    isConnected = true;
    console.log('Connected to SuperAdmin Database (mscurechain)');
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
import analyticsRoutes from './routes/analyticsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import broadcastRoutes from './routes/broadcastRoutes.js';
import { protect } from './middleware/authMiddleware.js';

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/analytics', protect, analyticsRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/broadcasts', protect, broadcastRoutes);

export default app;
