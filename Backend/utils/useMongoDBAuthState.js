import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';

export const useMongoDBAuthState = async (WhatsAppAuthModel) => {
  // High-performance in-memory cache to eliminate 99% of WAN round-trips to MongoDB Atlas
  const memoryCache = new Map();

  const writeData = async (data, id) => {
    try {
      memoryCache.set(id, data);
      const stringifiedData = JSON.stringify(data, BufferJSON.replacer);
      await WhatsAppAuthModel.findOneAndUpdate(
        { id },
        { data: stringifiedData },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('[MongoDB Auth] Write Error:', err);
    }
  };

  const readData = async (id) => {
    if (memoryCache.has(id)) {
      return memoryCache.get(id);
    }
    try {
      const document = await WhatsAppAuthModel.findOne({ id }).lean();
      if (document && document.data) {
        const parsed = JSON.parse(document.data, BufferJSON.reviver);
        memoryCache.set(id, parsed);
        return parsed;
      }
      return null;
    } catch (err) {
      console.error('[MongoDB Auth] Read Error:', err);
      return null;
    }
  };

  const removeData = async (id) => {
    memoryCache.delete(id);
    try {
      await WhatsAppAuthModel.findOneAndDelete({ id });
    } catch (err) {
      console.error('[MongoDB Auth] Remove Error:', err);
    }
  };

  const creds = (await readData('creds')) || initAuthCreds();
  memoryCache.set('creds', creds);

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          const missingKeys = [];
          const keyToIdMap = new Map();

          // 1. Check in-memory cache first (0ms latency)
          for (const id of ids) {
            const key = `${type}-${id}`;
            if (memoryCache.has(key)) {
              let val = memoryCache.get(key);
              if (type === 'app-state-sync-key' && val && proto?.Message?.AppStateSyncKeyData) {
                val = proto.Message.AppStateSyncKeyData.fromObject(val);
              }
              data[id] = val;
            } else {
              missingKeys.push(key);
              keyToIdMap.set(key, id);
            }
          }

          // 2. Fetch all missing keys in a SINGLE batch query instead of N individual queries
          if (missingKeys.length > 0) {
            try {
              const docs = await WhatsAppAuthModel.find({ id: { $in: missingKeys } }).lean();
              for (const doc of docs) {
                if (doc && doc.data) {
                  try {
                    let parsed = JSON.parse(doc.data, BufferJSON.reviver);
                    memoryCache.set(doc.id, parsed);
                    const originalId = keyToIdMap.get(doc.id);
                    if (originalId) {
                      if (type === 'app-state-sync-key' && parsed && proto?.Message?.AppStateSyncKeyData) {
                        parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
                      }
                      data[originalId] = parsed;
                    }
                  } catch (parseErr) {
                    console.warn(`[MongoDB Auth] Failed to parse key ${doc.id}:`, parseErr.message);
                  }
                }
              }
            } catch (queryErr) {
              console.error('[MongoDB Auth] Batch query error:', queryErr.message);
            }
          }

          return data;
        },
        set: async (data) => {
          const bulkOps = [];

          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;

              if (value) {
                memoryCache.set(key, value);
                try {
                  const stringified = JSON.stringify(value, BufferJSON.replacer);
                  bulkOps.push({
                    updateOne: {
                      filter: { id: key },
                      update: { $set: { data: stringified } },
                      upsert: true
                    }
                  });
                } catch (e) {}
              } else {
                memoryCache.delete(key);
                bulkOps.push({
                  deleteOne: {
                    filter: { id: key }
                  }
                });
              }
            }
          }

          // Non-blocking bulkWrite for fast message processing
          if (bulkOps.length > 0) {
            WhatsAppAuthModel.bulkWrite(bulkOps, { ordered: false }).catch(err => {
              console.warn('[MongoDB Auth] Background bulkWrite warning:', err.message);
            });
          }
        }
      }
    },
    saveCreds: () => {
      memoryCache.set('creds', creds);
      return writeData(creds, 'creds');
    },
    clearState: async () => {
      memoryCache.clear();
      try {
        await WhatsAppAuthModel.deleteMany({});
      } catch (e) {
        console.error('[MongoDB Auth] Clear State Error:', e);
      }
    }
  };
};

