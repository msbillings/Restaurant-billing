import mongoose from 'mongoose';
import Broadcast from '../models/Broadcast.js';
import BroadcastReply from '../models/BroadcastReply.js';
import Client from '../models/Client.js';

export const getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate('targetClients', 'restaurantName ownerName email databaseName')
      .sort({ createdAt: -1 });
    res.status(200).json(broadcasts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching broadcasts', error: error.message });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const { title, message, imageUrl, fileUrl, fileType, targetClients, targetRoles, allowReplies } = req.body;
    
    // Parse JSON strings if sent as FormData
    let parsedClients = [];
    if (targetClients) {
      const raw = typeof targetClients === 'string' ? JSON.parse(targetClients) : targetClients;
      if (Array.isArray(raw)) {
        parsedClients = raw
          .map(id => typeof id === 'object' ? (id._id || id.id) : id)
          .filter(id => id && mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));
      }
    }
    
    let parsedRoles = [];
    if (targetRoles) {
      const raw = typeof targetRoles === 'string' ? JSON.parse(targetRoles) : targetRoles;
      if (Array.isArray(raw)) {
        parsedRoles = raw.filter(r => r && typeof r === 'string');
      }
    }

    // If file was uploaded via multer, use that URL instead of the body
    let finalFileUrl = fileUrl;
    let finalFileType = fileType;
    
    if (req.file) {
      finalFileUrl = `/uploads/${req.file.filename}`;
      // Basic type inference
      if (req.file.mimetype.includes('image')) finalFileType = 'image';
      else if (req.file.originalname.endsWith('.apk')) finalFileType = 'apk';
      else if (req.file.originalname.endsWith('.ipa')) finalFileType = 'ipa';
      else finalFileType = 'document';
    }

    const newBroadcast = new Broadcast({ 
      title, 
      message, 
      imageUrl,
      fileUrl: finalFileUrl,
      fileType: finalFileType,
      targetClients: parsedClients,
      targetRoles: parsedRoles,
      allowReplies: allowReplies === 'true' || allowReplies === true
    });
    
    await newBroadcast.save();
    
    if (req.app.locals.io) {
      req.app.locals.io.emit('new_broadcast', newBroadcast);
    }
    
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
    
    if (req.app.locals.io) {
      req.app.locals.io.emit('update_broadcast', broadcast);
    }
    
    res.status(200).json(broadcast);
  } catch (error) {
    res.status(500).json({ message: 'Error updating broadcast', error: error.message });
  }
};

export const updateBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, imageUrl, fileUrl, fileType, targetClients, targetRoles, allowReplies } = req.body;
    
    let parsedClients = typeof targetClients === 'string' ? JSON.parse(targetClients) : targetClients || [];
    let parsedRoles = typeof targetRoles === 'string' ? JSON.parse(targetRoles) : targetRoles || [];

    const broadcast = await Broadcast.findById(id);
    if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });

    let finalFileUrl = fileUrl || broadcast.fileUrl;
    let finalFileType = fileType || broadcast.fileType;
    
    if (req.file) {
      finalFileUrl = `/uploads/${req.file.filename}`;
      if (req.file.mimetype.includes('image')) finalFileType = 'image';
      else if (req.file.originalname.endsWith('.apk')) finalFileType = 'apk';
      else if (req.file.originalname.endsWith('.ipa')) finalFileType = 'ipa';
      else finalFileType = 'document';
    }

    broadcast.title = title || broadcast.title;
    broadcast.message = message || broadcast.message;
    if (imageUrl !== undefined) broadcast.imageUrl = imageUrl;
    broadcast.fileUrl = finalFileUrl;
    broadcast.fileType = finalFileType;
    broadcast.targetClients = parsedClients;
    broadcast.targetRoles = parsedRoles;
    if (allowReplies !== undefined) broadcast.allowReplies = allowReplies === 'true' || allowReplies === true;

    await broadcast.save();
    
    if (req.app.locals.io) {
      req.app.locals.io.emit('update_broadcast', broadcast);
    }
    
    res.status(200).json(broadcast);
  } catch (error) {
    res.status(500).json({ message: 'Error updating broadcast', error: error.message });
  }
};

export const deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    await Broadcast.findByIdAndDelete(id);
    
    if (req.app.locals.io) {
      req.app.locals.io.emit('delete_broadcast', id);
    }
    
    res.status(200).json({ message: 'Broadcast deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting broadcast', error: error.message });
  }
};

// Client API: Get active broadcasts for a specific client and role
export const getClientBroadcasts = async (req, res) => {
  try {
    const { clientId } = req.params; // this is actually the databaseName from POS frontend
    const { role } = req.query; // e.g. Admin, Cashier, Captain

    const query = { active: true };

    const activeBroadcasts = await Broadcast.find(query).sort({ createdAt: -1 });
    console.log("ALL ACTIVE BROADCASTS FROM DB:", JSON.stringify(activeBroadcasts, null, 2));
    
    // Find the actual client document by databaseName or _id
    let clientDoc = await Client.findOne({ databaseName: clientId });
    if (!clientDoc && mongoose.Types.ObjectId.isValid(clientId)) {
      clientDoc = await Client.findById(clientId);
    }
    const realClientId = clientDoc ? clientDoc._id.toString() : null;

    // Filter in memory for simplicity given array complexities
    const filteredBroadcasts = activeBroadcasts.filter(b => {
      // 1. Check if client matches (if targetClients is empty, it's global to all shops)
      let clientMatch = true;
      if (b.targetClients && b.targetClients.length > 0) {
        if (!realClientId) {
          return false;
        }
        clientMatch = b.targetClients.some(cId => cId.toString() === realClientId);
      }
      
      // 2. Check if role matches (if targetRoles is empty, it's all roles)
      let roleMatch = true;
      if (b.targetRoles && b.targetRoles.length > 0) {
        if (!role) return false;
        roleMatch = b.targetRoles.some(r => r.toLowerCase() === (role || '').toLowerCase());
      }

      return clientMatch && roleMatch;
    });

    // Fetch existing replies for this client
    let clientReplies = [];
    if (clientDoc) {
      clientReplies = await BroadcastReply.find({
        clientId: clientDoc._id,
        broadcastId: { $in: filteredBroadcasts.map(b => b._id) }
      });
    }

    const replyMap = {};
    clientReplies.forEach(r => {
      replyMap[r.broadcastId.toString()] = {
        _id: r._id,
        message: r.message,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        senderUsername: r.senderUsername,
        senderRole: r.senderRole
      };
    });

    const broadcastsWithReply = filteredBroadcasts.map(b => {
      const bObj = b.toObject ? b.toObject() : { ...b };
      const rep = replyMap[b._id.toString()];
      bObj.myReply = rep ? rep.message : null;
      bObj.myReplyData = rep || null;
      return bObj;
    });

    res.status(200).json(broadcastsWithReply);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client broadcasts', error: error.message });
  }
};

// Submit a reply from POS terminal
export const replyToBroadcast = async (req, res) => {
  try {
    const { broadcastId, clientId, shopName, senderUsername, senderRole, message } = req.body;
    
    // Find the actual client document by databaseName or by ObjectId or by restaurantName
    let clientDoc = await Client.findOne({ databaseName: clientId });
    if (!clientDoc && mongoose.Types.ObjectId.isValid(clientId)) {
      clientDoc = await Client.findById(clientId);
    }
    if (!clientDoc && shopName) {
      const safeName = shopName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clientDoc = await Client.findOne({ 
        $or: [
          { restaurantName: { $regex: new RegExp(safeName, 'i') } },
          { databaseName: { $regex: new RegExp(safeName, 'i') } }
        ]
      });
    }
    if (!clientDoc) {
      clientDoc = await Client.findOne();
    }

    if (!clientDoc) {
      return res.status(404).json({ message: 'Client not found' });
    }

    let bId = broadcastId;
    if (!mongoose.Types.ObjectId.isValid(bId)) {
      const bDoc = await Broadcast.findOne({ title: { $regex: new RegExp(broadcastId, 'i') } });
      if (bDoc) bId = bDoc._id;
      else {
        const latestB = await Broadcast.findOne({ active: true });
        if (latestB) bId = latestB._id;
      }
    }

    // Find if a reply already exists for this broadcast & client
    let reply = await BroadcastReply.findOne({ broadcastId: bId, clientId: clientDoc._id });
    if (reply) {
      reply.message = message;
      reply.senderUsername = senderUsername || reply.senderUsername;
      reply.senderRole = senderRole || reply.senderRole;
      reply.shopName = shopName || clientDoc.restaurantName || reply.shopName;
      await reply.save();
    } else {
      reply = new BroadcastReply({
        broadcastId: bId,
        clientId: clientDoc._id,
        shopName: shopName || clientDoc.restaurantName || 'Restaurant',
        senderUsername: senderUsername || 'Admin',
        senderRole: senderRole || 'Admin',
        message
      });
      await reply.save();
    }
    
    res.status(201).json(reply);
  } catch (error) {
    console.error('Error submitting reply:', error);
    res.status(500).json({ message: 'Error submitting reply', error: error.message });
  }
};

// Get all replies for Super Admin
export const getBroadcastReplies = async (req, res) => {
  try {
    const replies = await BroadcastReply.find()
      .populate('broadcastId')
      .populate('clientId', 'restaurantName databaseName')
      .sort({ createdAt: -1 });
    res.status(200).json(replies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching replies', error: error.message });
  }
};
