// Mock controller for Sync operations

// Simulated database state for sync metadata
let lastSyncedAt = new Date(Date.now() - 3600000); // 1 hour ago
let pendingChanges = Math.floor(Math.random() * 50) + 10;

export const getSyncStatus = async (req, res) => {
  try {
    // In a real app, this would check local PouchDB/IndexedDB against Cloud MongoDB
    res.status(200).json({
      lastSyncedAt,
      pendingChanges,
      isOnline: true, // Assuming internet is connected
      cloudDbStatus: 'connected'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sync status', error: error.message });
  }
};

export const triggerSync = async (req, res) => {
  try {
    // Simulate a sync process taking 2-4 seconds
    const delay = Math.floor(Math.random() * 2000) + 2000;
    
    setTimeout(() => {
      // After sync is complete, update metadata
      lastSyncedAt = new Date();
      const recordsSynced = pendingChanges;
      pendingChanges = 0; // Reset pending changes
      
      res.status(200).json({
        message: 'Sync completed successfully',
        lastSyncedAt,
        recordsSynced,
        status: 'success'
      });
    }, delay);
  } catch (error) {
    res.status(500).json({ message: 'Error triggering sync', error: error.message });
  }
};
