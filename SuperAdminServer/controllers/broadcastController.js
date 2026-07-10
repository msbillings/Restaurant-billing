import Broadcast from '../models/Broadcast.js';

export const getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find().sort({ createdAt: -1 });
    res.status(200).json(broadcasts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching broadcasts', error: error.message });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const { title, message, imageUrl } = req.body;
    const newBroadcast = new Broadcast({ title, message, imageUrl });
    await newBroadcast.save();
    res.status(201).json(newBroadcast);
  } catch (error) {
    res.status(500).json({ message: 'Error creating broadcast', error: error.message });
  }
};

export const toggleBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await Broadcast.findById(id);
    if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });
    
    broadcast.active = !broadcast.active;
    await broadcast.save();
    res.status(200).json(broadcast);
  } catch (error) {
    res.status(500).json({ message: 'Error updating broadcast', error: error.message });
  }
};

export const deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    await Broadcast.findByIdAndDelete(id);
    res.status(200).json({ message: 'Broadcast deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting broadcast', error: error.message });
  }
};
