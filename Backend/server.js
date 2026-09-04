// Fix for Electron missing crypto in old Node versions, but safe for Node 20+
import _crypto from 'crypto';
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) { }
if (!globalThis.crypto) {
  try {
    Object.defineProperty(globalThis, 'crypto', { value: _crypto });
  } catch (e) {
    // Ignore if already has a getter
  }
}

import { isSettingUpDB } from "./controllers/configController.js";

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { execSync } from 'child_process';
import { initFirebase } from './utils/firebase.js';

// __dirname is not available in ES modules — polyfill it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Initialize Firebase Admin for Push Notifications
initFirebase();

const app = express();
app.use(compression());
const server = http.createServer(app);
app.set('trust proxy', 1); // Required for Render.com / Vercel reverse proxy rate limiting

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  // Add frontend URL from environment variable
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  // Allow from CORS_ORIGIN environment variable (comma-separated)
  ...(process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : [])
];

const corsOptions = {
  origin: true, // Allow all origins explicitly
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-DB', 'X-License-Key', 'x-tenant-db', 'x-license-key', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-DB', 'X-License-Key', 'x-tenant-db', 'x-license-key']
};

app.use(cors(corsOptions));

// Security Middleware Imports
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import sanitize from 'mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';

// 1. Set Security HTTP Headers
// CSP is relaxed to allow the static React SPA (served from this same server) to load correctly.
// API routes are still protected by rate limiting and auth middleware.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",    // Required for Vite-built React (inline bootstrap script)
        "'unsafe-eval'",      // Required for some React/Vite chunks
        "cdn.jsdelivr.net",   // jsmpeg CDN used for camera feed
        "blob:"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"], // Allow WS + API calls to any host
      mediaSrc: ["'self'", "blob:", "data:"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false, // Required for SharedArrayBuffer / camera features
}));

// 2. Limit requests from same API (Rate Limiting)
const limiter = rateLimit({
  max: 10000, // Safe limit for busy restaurants
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' })); // Body limit is increased to support base64 images

// Initialize Socket.io with same CORS config as express
const io = new Server(server, {
  cors: {
    origin: true, // Mirror the same open-CORS policy as express
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  }
});
app.locals.io = io;

io.on('connection', (socket) => {
  socket.on('joinTenant', (data) => {
    let tenantDb = null;
    let token = null;
    if (data && typeof data === 'object') {
      tenantDb = data.tenantDb;
      token = data.token;
    } else {
      tenantDb = data;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_msbillings_2026');
        if (decoded && decoded.db) {
          tenantDb = decoded.db;
        }
      } catch (err) {
        // Fall back to tenantDb passed if token expired or invalid
      }
    }

    const isCloud = !!(process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production');
    if (isCloud && !token && !tenantDb) {
      console.warn('[Socket] Refused unauthenticated socket join on cloud');
      return;
    }

    if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
      // Leave any existing rooms except its own socket id room
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.leave(room);
        }
      }
      socket.join(tenantDb);
      socket.tenantDb = tenantDb;
      console.log(`[Socket] Socket ${socket.id} securely joined tenant room: ${tenantDb}`);
    }
  });
});

// 3. Data sanitization against NoSQL query injection
// Custom middleware to handle Express 5 read-only properties (req.query)
app.use((req, res, next) => {
  try {
    // Sanitize req.body
    if (req.body) {
      req.body = sanitize(req.body);
    }

    // Sanitize req.query (In-place modification for Express 5 compatibility)
    if (req.query) {
      const cleanedQuery = sanitize(req.query);
      // For Express 5, defineProperty is needed to overwrite the getter if assignment fails
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

    // Sanitize req.params
    if (req.params) {
      const cleanedParams = sanitize(req.params);
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
import xssFilter from 'xss';

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

// Enforce Mongoose strict mode for queries to prevent unexpected schema fields
mongoose.set('strictQuery', true);

app.use(hpp());



// Health check route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Your restaurant billing backend is running perfect!..!',
    timestamp: new Date().toISOString()
  });
});

// APK connectivity test — used by LicenseScreen to verify server is reachable before saving IP
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'MS Billing Backend',
    timestamp: new Date().toISOString()
  });
});



// Database Connection
// SECURITY: Do not default to a production database. Use an isolated temp DB.
let MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

// Read client-config.json if it exists to override the database name dynamically
// If APP_USER_DATA_PATH is provided (via Electron), use it. Otherwise fallback to process.cwd()
try {
  const configDir = process.env.APP_USER_DATA_PATH || process.cwd();
  const configPath = path.join(configDir, 'client-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.databaseName) {
      const parts = MONGO_URI.split('?');
      const connectionPart = parts[0];
      const queryPart = parts.length > 1 ? `?${parts[1]}` : '';
      const lastSlashIndex = connectionPart.lastIndexOf('/');
      const newConnectionPart = connectionPart.substring(0, lastSlashIndex) + '/' + config.databaseName;
      MONGO_URI = newConnectionPart + queryPart;
      console.log(`Using client-specific database: ${config.databaseName}`);
    }
  }
} catch (error) {
  console.error('Failed to parse client-config.json, using default database', error);
}

// Connection state
let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  // If already connected, return
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  // If connection is in progress, return the existing promise
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000, // Increased for serverless
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 1,
  }).then((connection) => {
    isConnected = true;
    console.log('Connected to MongoDB');
    return connection;
  }).catch((error) => {
    console.error('MongoDB connection error:', error);
    connectionPromise = null; // Reset on error to allow retry
    isConnected = false;
    throw error;
  });

  return connectionPromise;
};

// Middleware to ensure DB connection before handling requests (for serverless)
const ensureDBConnection = async (req, res, next) => {
  try {
    if (isSettingUpDB) {
      // If the database is currently being configured, skip the connection check 
      // for other routes so we don't cause a concurrent connection race condition
      return next();
    }
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

import { tenantMiddleware } from './middleware/tenant.js';

// Apply middleware to all API routes BEFORE routes are registered
app.use('/api', ensureDBConnection);
app.use('/api', tenantMiddleware);

// Routes
import menuRoutes from './routes/menuRoutes.js';
import billRoutes from './routes/billRoutes.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import configRoutes from './routes/configRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import floorRoutes from './routes/floorRoutes.js';
import aggregatorRoutes from './routes/aggregatorRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import serviceRequestRoutes from './routes/serviceRequestRoutes.js';
import taxRoutes from './routes/taxRoutes.js';
import discountRoutes from './routes/discountRoutes.js';
import cashLogRoutes from './routes/cashLogRoutes.js';
import creditAccountRoutes from './routes/creditAccountRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import pushOrderRoutes from './routes/pushOrderRoutes.js';
import printerConfigRoutes from './routes/printerConfigRoutes.js';
import onlineConfigRoutes from './routes/onlineConfigRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cameraRoutes from './routes/cameraRoutes.js';
import loyaltyRoutes from './routes/loyaltyRoutes.js';
import broadcastRoutes from './routes/broadcastRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import startSessionCleanupJob from './utils/sessionCleanup.js';
import { startBackupCron } from './utils/backupManager.js';
import { startReportCron } from './utils/reportGenerator.js';
import { startWhatsAppScheduler } from './utils/whatsappScheduler.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

app.use('/api/menu', menuRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/config', configRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/aggregators', aggregatorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/cash-logs', cashLogRoutes);
app.use('/api/credit-accounts', creditAccountRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/push-orders', pushOrderRoutes);
app.use('/api/printer-configs', printerConfigRoutes);
app.use('/api/online-configs', onlineConfigRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/contact', contactRoutes);

// WhatsApp sessions are lazily initialized via WhatsAppManager in whatsappController.js

// --- GLOBAL ERROR HANDLER ---
// Must be placed after all API route definitions
app.use(globalErrorHandler);

// Serve AI Face Detection models statically over HTTP with CORS
const possibleModelPaths = [
  path.join(process.cwd(), '../Frontend/public/models'),
  path.join(process.cwd(), '../frontend/models'),
  path.join(process.cwd(), 'frontend/models'),
  path.join(process.cwd(), 'public/models'),
  path.join(process.cwd(), 'dist/models'),
  path.join(__dirname, '../Frontend/public/models'),
  path.join(__dirname, 'public/models')
];
const staticModelsDir = possibleModelPaths.find(p => p && fs.existsSync(path.join(p, 'tiny_face_detector_model-weights_manifest.json')));
if (staticModelsDir) {
  console.log(`[Static Models] Serving AI face models from: ${staticModelsDir}`);
  app.use('/models', express.static(staticModelsDir));
}

// ─── Serve Static Frontend for Customer QR Ordering ─────────────────────────
// Priority order: Desktop packaged folder → dev build → fallback
const frontendCandidates = [
  path.join(__dirname, 'frontend'),                // Packaged: inside backend folder (resources/backend/frontend)
  path.join(__dirname, '../Frontend/dist'),        // Dev: sibling Frontend/dist
  path.join(__dirname, '../frontend'),             // Electron packaged copy
  path.join(process.cwd(), '../Frontend/dist'),    // Alt dev layout
  path.join(process.cwd(), 'frontend'),            // Electron: Desktop/frontend
];

const staticFrontendDir = frontendCandidates.find(p => {
  const indexPath = path.join(p, 'index.html');
  return fs.existsSync(indexPath);
});

if (staticFrontendDir) {
  console.log(`[Static Frontend] ✅ Serving from: ${staticFrontendDir}`);


  // Serve static assets for root /assets AND sub-route /order/assets
  const assetsDir = path.join(staticFrontendDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir, { fallthrough: false }));
    app.use('/order/assets', express.static(assetsDir, { fallthrough: false }));
  }

  // Serve all static assets (JS, CSS, images, icons, etc.)
  app.use(express.static(staticFrontendDir, { index: false }));

  // Explicit /order route — ALWAYS serve the customer ordering page
  app.get(['/order', '/order/'], (_req, res) => {
    const indexPath = path.join(staticFrontendDir, 'index.html');
    res.setHeader('Cache-Control', 'no-store'); // Prevent stale cache on mobile
    res.sendFile(indexPath);
  });

  // SPA Fallback for other non-API routes (floor, billing, etc.)
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/models') || req.path.startsWith('/assets') || req.path.includes('.')) {
      return next();
    }
    const indexPath = path.join(staticFrontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
} else {
  console.warn('[Static Frontend] ⚠️  No built frontend found. QR customer ordering unavailable.');
  // Still serve /order with a helpful message instead of hanging
  app.get('/order', (req, res) => {
    res.status(503).send('<h2>Customer Menu Not Available</h2><p>The frontend has not been built yet. Please run <code>npm run build</code> in the Frontend folder.</p>');
  });
}


const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (!isServerless) {
  // Start background session cleanup job
  startSessionCleanupJob();

  // Start data vault backup job (Daily at 3:00 AM)
  startBackupCron();

  // Start EOD Report job (Daily at 11:59 PM)
  startReportCron();

  // Start WhatsApp Scheduler
  startWhatsAppScheduler();
}

// Initialize connection for serverless (non-blocking)
// Connection will be established on first request via middleware
if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
  // In serverless, connect on module load but don't block
  connectDB().catch((err) => {
    console.error('Initial connection attempt failed (will retry on request):', err.message);
  });
}

// Only start server if not in serverless environment (local development)
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  // The Desktop app's frontend falls back to localhost:5002 when process.env.VITE_API_URL is undefined
  const PORT = process.env.PORT || 5002;

  const startListening = () => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server & Socket.io running on 0.0.0.0:${PORT}`);
    });
  };

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${PORT} is already in use. Attempting to free port...`);
      try {
        if (process.platform === 'win32') {
          const out = execSync(`netstat -ano | findstr :${PORT}`).toString();
          const lines = out.split('\n');
          for (const line of lines) {
            if (line.includes('LISTENING')) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && pid !== '0' && parseInt(pid) !== process.pid) {
                console.warn(`[Server] Force terminating occupying PID ${pid} on port ${PORT}...`);
                try {
                  execSync(`taskkill /F /PID ${pid}`);
                } catch (_) {}
              }
            }
          }
        } else {
          try {
            execSync(`fuser -k ${PORT}/tcp`);
          } catch (_) {}
        }
      } catch (e) {
        console.error(`[Server] Could not automatically kill process on port ${PORT}:`, e.message);
      }

      setTimeout(() => {
        console.log(`[Server] Retrying to listen on port ${PORT}...`);
        startListening();
      }, 1000);
    } else {
      console.error('Server error:', err);
    }
  });

  connectDB().then(() => {
    startListening();
  }).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;