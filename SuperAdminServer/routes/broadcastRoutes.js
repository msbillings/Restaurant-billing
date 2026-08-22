import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  getBroadcasts, 
  createBroadcast, 
  toggleBroadcast, 
  deleteBroadcast,
  getClientBroadcasts,
  replyToBroadcast,
  getBroadcastReplies,
  updateBroadcast
} from '../controllers/broadcastController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

import os from 'os';

// Ensure uploads directory exists (use os.tmpdir for Vercel/serverless compatibility)
const uploadDir = path.join(os.tmpdir(), 'uploads');
if (!fs.existsSync(uploadDir)){
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {}
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

// Limit file size to 50MB for APKs
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } 
});

// Super Admin routes
router.get('/', protect, getBroadcasts);
router.post('/', protect, upload.single('file'), createBroadcast);
router.put('/:id', protect, upload.single('file'), updateBroadcast);
router.put('/:id/toggle', protect, toggleBroadcast);
router.delete('/:id', protect, deleteBroadcast);
router.get('/replies', protect, getBroadcastReplies);

// POS Client routes
router.get('/client/:clientId', getClientBroadcasts);
router.post('/reply', replyToBroadcast);

export default router;
