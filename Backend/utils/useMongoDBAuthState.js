import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

export const useMongoDBAuthState = async (WhatsAppAuthModel) => {
  const writeData = async (data, id) => {
    try {
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
    try {
      const document = await WhatsAppAuthModel.findOne({ id });
      if (document && document.data) {
        return JSON.parse(document.data, BufferJSON.reviver);
      }
      return null;
    } catch (err) {
      console.error('[MongoDB Auth] Read Error:', err);
      return null;
    }
  };

  const removeData = async (id) => {
    try {
      await WhatsAppAuthModel.findOneAndDelete({ id });
    } catch (err) {
      console.error('[MongoDB Auth] Remove Error:', err);
    }
  };

  const creds = await readData('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = import('@whiskeysockets/baileys').then(b => b.proto.Message.AppStateSyncKeyData.fromObject(value));
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(value, key));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => {
      return writeData(creds, 'creds');
    },
    clearState: async () => {
      try {
        await WhatsAppAuthModel.deleteMany({});
      } catch (e) {
        console.error('[MongoDB Auth] Clear State Error:', e);
      }
    }
  };
};
