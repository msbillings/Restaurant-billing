import mongoose from 'mongoose';

/**
 * SuperAdmin: Get all broadcasts with populated client details
 */
export const getBroadcasts = async (req, res) => {
  try {
    const db = mongoose.connection.useDb('mscurechain');
    const broadcasts = await db.collection('broadcasts').find().sort({ createdAt: -1 }).toArray();

    // Populate targetClients with restaurant names
    const clients = await db.collection('clients').find().toArray();
    const clientMap = new Map(clients.map(c => [c._id.toString(), c]));

    const populated = broadcasts.map(b => {
      let populatedClients = [];
      if (b.targetClients && Array.isArray(b.targetClients)) {
        populatedClients = b.targetClients.map(cId => {
          const client = clientMap.get(cId.toString());
          return client ? { _id: client._id, restaurantName: client.restaurantName, databaseName: client.databaseName } : { _id: cId };
        });
      }
      return { ...b, targetClients: populatedClients };
    });

    res.status(200).json(populated);
  } catch (error) {
    console.error('[Backend BroadcastController] Error:', error);
    res.status(500).json({ message: 'Error fetching broadcasts', error: error.message });
  }
};

/**
 * SuperAdmin: Create a new broadcast with targeted clients & roles
 */
export const createBroadcast = async (req, res) => {
  try {
    const { title, message, imageUrl, fileUrl, fileType, targetClients, targetRoles, allowReplies } = req.body;

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

    const db = mongoose.connection.useDb('mscurechain');
    const newDoc = {
      title,
      message,
      imageUrl: imageUrl || '',
      fileUrl: fileUrl || '',
      fileType: fileType || '',
      targetClients: parsedClients,
      targetRoles: parsedRoles,
      allowReplies: allowReplies === 'true' || allowReplies === true,
      active: true,
      createdAt: new Date()
    };

    const result = await db.collection('broadcasts').insertOne(newDoc);
    newDoc._id = result.insertedId;

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('[Backend BroadcastController] Error creating broadcast:', error);
    res.status(500).json({ message: 'Error creating broadcast', error: error.message });
  }
};

/**
 * SuperAdmin: Update existing broadcast
 */
export const updateBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, imageUrl, fileUrl, fileType, targetClients, targetRoles, allowReplies } = req.body;

    let parsedClients = [];
    if (targetClients) {
      const raw = typeof targetClients === 'string' ? JSON.parse(targetClients) : targetClients;
      if (Array.isArray(raw)) {
        parsedClients = raw
          .map(c => typeof c === 'object' ? (c._id || c.id) : c)
          .filter(c => c && mongoose.Types.ObjectId.isValid(c))
          .map(c => new mongoose.Types.ObjectId(c));
      }
    }

    let parsedRoles = [];
    if (targetRoles) {
      const raw = typeof targetRoles === 'string' ? JSON.parse(targetRoles) : targetRoles;
      if (Array.isArray(raw)) {
        parsedRoles = raw.filter(r => r && typeof r === 'string');
      }
    }

    const db = mongoose.connection.useDb('mscurechain');
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (message !== undefined) updateFields.message = message;
    if (imageUrl !== undefined) updateFields.imageUrl = imageUrl;
    if (fileUrl !== undefined) updateFields.fileUrl = fileUrl;
    if (fileType !== undefined) updateFields.fileType = fileType;
    if (targetClients !== undefined) updateFields.targetClients = parsedClients;
    if (targetRoles !== undefined) updateFields.targetRoles = parsedRoles;
    if (allowReplies !== undefined) updateFields.allowReplies = allowReplies === 'true' || allowReplies === true;

    await db.collection('broadcasts').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateFields }
    );

    const updated = await db.collection('broadcasts').findOne({ _id: new mongoose.Types.ObjectId(id) });
    res.status(200).json(updated);
  } catch (error) {
    console.error('[Backend BroadcastController] Error updating broadcast:', error);
    res.status(500).json({ message: 'Error updating broadcast', error: error.message });
  }
};

/**
 * SuperAdmin: Toggle broadcast active status
 */
export const toggleBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.useDb('mscurechain');
    const doc = await db.collection('broadcasts').findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!doc) return res.status(404).json({ message: 'Broadcast not found' });

    const newActive = !doc.active;
    await db.collection('broadcasts').updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { active: newActive } }
    );

    doc.active = newActive;
    res.status(200).json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Error toggling broadcast', error: error.message });
  }
};

/**
 * SuperAdmin: Delete broadcast
 */
export const deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const db = mongoose.connection.useDb('mscurechain');
    await db.collection('broadcasts').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    res.status(200).json({ message: 'Broadcast deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting broadcast', error: error.message });
  }
};

/**
 * Get active broadcasts for the requesting POS client and role
 */
export const getClientBroadcasts = async (req, res) => {
  try {
    const tenantDb = req.params.clientId || req.tenantDb || req.headers['x-tenant-db'] || req.query.tenant || req.query.clientId;
    const role = (req.query.role || req.user?.role || 'Admin').toLowerCase();

    const db = mongoose.connection.useDb('mscurechain');
    const activeBroadcasts = await db.collection('broadcasts').find({ active: true }).sort({ createdAt: -1 }).toArray();

    let realClientId = null;
    if (tenantDb) {
      const clientDoc = await db.collection('clients').findOne({ 
        $or: [
          { databaseName: tenantDb },
          ...(mongoose.Types.ObjectId.isValid(tenantDb) ? [{ _id: new mongoose.Types.ObjectId(tenantDb) }] : [])
        ]
      });
      if (clientDoc) {
        realClientId = clientDoc._id.toString();
      }
    }

    const filteredBroadcasts = activeBroadcasts.filter(b => {
      // 1. Check if client matches (if targetClients is empty, it's global to all restaurants)
      if (b.targetClients && Array.isArray(b.targetClients) && b.targetClients.length > 0) {
        if (!realClientId) return false;
        const matchesClient = b.targetClients.some(cId => cId.toString() === realClientId);
        if (!matchesClient) return false;
      }

      // 2. Check if role matches (if targetRoles is empty, it's sent to all roles)
      if (b.targetRoles && Array.isArray(b.targetRoles) && b.targetRoles.length > 0) {
        const matchesRole = b.targetRoles.some(r => (r || '').toLowerCase() === role);
        if (!matchesRole) return false;
      }

      return true;
    });

    res.json(filteredBroadcasts);
  } catch (error) {
    console.error('[Backend BroadcastController] Error:', error);
    res.status(500).json({ message: 'Error fetching broadcasts', error: error.message });
  }
};

/**
 * Submit reply to a broadcast from POS terminal
 */
export const replyToBroadcast = async (req, res) => {
  try {
    const { broadcastId, shopName, senderUsername, senderRole, message } = req.body;
    const tenantDb = req.tenantDb || req.headers['x-tenant-db'] || req.body.clientId;

    const db = mongoose.connection.useDb('mscurechain');
    let clientDoc = null;
    if (tenantDb) {
      clientDoc = await db.collection('clients').findOne({ databaseName: tenantDb });
    }

    const reply = {
      broadcastId: mongoose.Types.ObjectId.isValid(broadcastId) ? new mongoose.Types.ObjectId(broadcastId) : broadcastId,
      clientId: clientDoc ? clientDoc._id : null,
      shopName: shopName || clientDoc?.restaurantName || tenantDb,
      senderUsername: senderUsername || 'Staff',
      senderRole: senderRole || 'Staff',
      message: message,
      createdAt: new Date()
    };

    await db.collection('broadcastreplies').insertOne(reply);
    res.status(201).json({ message: 'Reply sent successfully', reply });
  } catch (error) {
    console.error('[Backend BroadcastController] Error saving reply:', error);
    res.status(500).json({ message: 'Error replying to broadcast', error: error.message });
  }
};
