import mongoose from 'mongoose';

/**
 * Get active broadcasts for the requesting POS client and role
 */
export const getClientBroadcasts = async (req, res) => {
  try {
    const tenantDb = req.params.clientId || req.tenantDb || req.headers['x-tenant-db'] || req.query.tenant || req.query.clientId;
    const role = (req.query.role || req.user?.role || 'Admin').toLowerCase();

    // Connect to mscurechain DB where broadcasts are stored
    const db = mongoose.connection.useDb('mscurechain');
    
    // Find active broadcasts
    const activeBroadcasts = await db.collection('broadcasts').find({ active: true }).sort({ createdAt: -1 }).toArray();

    // Find client doc for this tenant database to resolve its master _id
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

    // Filter broadcasts based on targeted clients and targeted roles
    const filteredBroadcasts = activeBroadcasts.filter(b => {
      // 1. Check if client matches (if targetClients is empty, it's global to all restaurants)
      if (b.targetClients && b.targetClients.length > 0) {
        if (!realClientId) return false;
        const matchesClient = b.targetClients.some(cId => cId.toString() === realClientId);
        if (!matchesClient) return false;
      }

      // 2. Check if role matches (if targetRoles is empty, it's sent to all roles)
      if (b.targetRoles && b.targetRoles.length > 0) {
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
