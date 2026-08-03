import express from 'express';
import { getTenantModel } from '../utils/tenantHelper.js';
import CameraDefault from '../models/Camera.js';
import { authenticateToken } from '../middleware/auth.js';
import { startCameraStream, stopCameraStream } from '../services/StreamManager.js';

const router = express.Router();

// Get all cameras
router.get('/', authenticateToken, async (req, res) => {
  try {
    const Camera = getTenantModel(req, 'Camera', CameraDefault);
    const cameras = await Camera.find().sort({ createdAt: -1 });
    res.json(cameras);
  } catch (error) {
    console.error('Error fetching cameras:', error);
    res.status(500).json({ message: 'Failed to fetch cameras' });
  }
});

// Add a new camera
router.post('/', authenticateToken, async (req, res) => {
  console.log('Received POST /api/cameras with body:', req.body);
  try {
    const { name, rtspUrl, location, status } = req.body;
    const Camera = getTenantModel(req, 'Camera', CameraDefault);
    
    const newCamera = new Camera({
      name,
      rtspUrl,
      location,
      status: status || 'offline',
    });
    
    await newCamera.save();
    res.status(201).json(newCamera);
  } catch (error) {
    console.error('Error adding camera:', error);
    res.status(500).json({ message: 'Failed to add camera' });
  }
});

// Delete a camera
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const Camera = getTenantModel(req, 'Camera', CameraDefault);
    await Camera.findByIdAndDelete(req.params.id);
    res.json({ message: 'Camera deleted' });
  } catch (error) {
    console.error('Error deleting camera:', error);
    res.status(500).json({ message: 'Failed to delete camera' });
  }
});

// Update camera status/details
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const Camera = getTenantModel(req, 'Camera', CameraDefault);
    const updated = await Camera.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    console.error('Error updating camera:', error);
    res.status(500).json({ message: 'Failed to update camera' });
  }
});

// Start RTSP stream for a camera
router.get('/:id/stream', authenticateToken, async (req, res) => {
  try {
    const Camera = getTenantModel(req, 'Camera', CameraDefault);
    const camera = await Camera.findById(req.params.id);
    
    if (!camera) return res.status(404).json({ message: 'Camera not found' });
    if (!camera.rtspUrl) return res.status(400).json({ message: 'Camera has no RTSP URL' });
    
    // Will start stream or return existing wsPort
    const streamInfo = await startCameraStream(camera._id.toString(), camera.rtspUrl);
    
    res.json({
      cameraId: camera._id,
      wsPort: streamInfo.wsPort,
      status: streamInfo.status
    });
  } catch (error) {
    console.error('Error starting camera stream:', error);
    res.status(500).json({ message: 'Failed to start camera stream' });
  }
});

export default router;
