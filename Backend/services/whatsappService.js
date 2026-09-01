import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAuthDir(tenantId = 'default') {
  const dirName = `auth_info_baileys_${tenantId}`;
  if (process.env.APP_USER_DATA_PATH) {
    const dir = path.join(process.env.APP_USER_DATA_PATH, dirName);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (e) {
      console.warn('[WhatsApp Service] Failed to create dir in APP_USER_DATA_PATH, using fallback:', e);
    }
  }

  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    const dir = path.join(os.tmpdir(), dirName);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (e) {}
  }

  // Development / Standard directory
  const localDir = path.join(__dirname, '..', dirName);
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    // Verify write permissions
    const testFile = path.join(localDir, '.write_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return localDir;
  } catch (e) {
    // If packaged in read-only path (e.g. Program Files), fallback to OS temp or home directory
    const fallbackDir = path.join(os.tmpdir(), `msbilling_baileys_auth_${tenantId}`);
    try {
      if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
      return fallbackDir;
    } catch (err) {
      return localDir;
    }
  }
}

import { getTenantModels } from '../utils/tenantManager.js';

class WhatsAppService {
  constructor(tenantId = 'default', restaurantName = null) {
    this.tenantId = tenantId;
    this.restaurantName = restaurantName;
    this.sock = null;
    this.qrDataUrl = null;
    this.status = 'DISCONNECTED'; // 'DISCONNECTED', 'SCAN_QR', 'CONNECTING', 'CONNECTED'
    this.connectedNumber = null;
    this.connectionListeners = new Set();
    this.isInitializing = false;
    this.authDir = getAuthDir(this.tenantId);
  }

  setRestaurantName(name) {
    if (name && typeof name === 'string' && name.trim()) {
      this.restaurantName = name.trim();
    }
  }

  getPlatformInfo() {
    const rawName = this.restaurantName || 'MS Billings POS';
    return {
      browserConfig: Browsers.macOS('Chrome'),
      platformName: rawName,
      deviceName: `${rawName} Gateway`
    };
  }

  async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }

      this.authDir = getAuthDir(this.tenantId);
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      let version;
      try {
        const vInfo = await fetchLatestBaileysVersion();
        version = vInfo.version;
      } catch (e) {
        version = [2, 3000, 1017531287];
      }

      const platformInfo = this.getPlatformInfo();

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: platformInfo.browserConfig,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      this.sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
        } catch (e) {
          console.warn('[WhatsApp Service] creds.update error:', e);
        }
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            this.status = 'SCAN_QR';
            this.notifyListeners();
          } catch (qrErr) {
            console.error('[WhatsApp Service] QR Generation Error:', qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
          const isRestartRequired = statusCode === 515 || statusCode === DisconnectReason.restartRequired;
          
          if (isLoggedOut) {
            console.log(`[WhatsApp Service - ${this.tenantId}] Logged out. Clearing credentials...`);
            this.status = 'DISCONNECTED';
            this.connectedNumber = null;
            this.qrDataUrl = null;
            this.clearAuth();
            this.notifyListeners();

            // Persist disconnected status in MongoDB
            getTenantModels(this.tenantId).then(models => {
              if (models?.Setting) {
                models.Setting.findOneAndUpdate(
                  { key: 'whatsapp_status' },
                  { value: { status: 'DISCONNECTED', connectedNumber: null, updatedAt: new Date().toISOString() } },
                  { upsert: true }
                ).catch(() => {});
              }
            }).catch(() => {});

            setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, 2000);
          } else {
            console.log(`[WhatsApp Service - ${this.tenantId}] Reconnecting (status: ${statusCode}, restartRequired: ${isRestartRequired})...`);
            this.status = isRestartRequired ? 'CONNECTING' : 'DISCONNECTED';
            this.notifyListeners();

            const delay = isRestartRequired ? 600 : 2500;
            setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, delay);
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrDataUrl = null;
          this.linkedAt = this.linkedAt || new Date().toISOString();
          const rawJid = this.sock?.user?.id || state?.creds?.me?.id || '';
          this.connectedNumber = rawJid.split(':')[0] || rawJid.split('@')[0] || null;
          console.log(`[WhatsApp Service - ${this.tenantId}] Connected successfully as +${this.connectedNumber} (${platformInfo.deviceName})`);
          this.notifyListeners();

          // Attempt to sync WhatsApp account profile name to restaurant name
          if (this.restaurantName && this.sock?.updateProfileName) {
            this.sock.updateProfileName(this.restaurantName)
              .then(() => console.log(`[WhatsApp Service - ${this.tenantId}] Synced profile name to "${this.restaurantName}"`))
              .catch(err => console.warn(`[WhatsApp Service - ${this.tenantId}] Note: Profile name update:`, err.message));
          }

          // Persist connected status in MongoDB for cross-platform visibility (.exe, .apk, Vercel)
          getTenantModels(this.tenantId).then(models => {
            if (models?.Setting) {
              models.Setting.findOneAndUpdate(
                { key: 'whatsapp_status' },
                {
                  value: {
                    status: 'CONNECTED',
                    connectedNumber: this.connectedNumber,
                    restaurantName: this.restaurantName || '',
                    platformName: platformInfo.platformName,
                    deviceName: platformInfo.deviceName,
                    linkedAt: this.linkedAt,
                    updatedAt: new Date().toISOString()
                  }
                },
                { upsert: true }
              ).catch(() => {});
            }
          }).catch(() => {});
        } else if (connection === 'connecting') {
          this.status = 'CONNECTING';
          this.notifyListeners();
        }
      });
    } catch (err) {
      console.error(`[WhatsApp Service - ${this.tenantId}] Init error:`, err);
      this.status = 'DISCONNECTED';
      this.notifyListeners();
    } finally {
      this.isInitializing = false;
    }
  }

  clearAuth() {
    try {
      const targetDir = this.authDir || getAuthDir();
      if (fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(targetDir, file));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('[WhatsApp Service] Clear auth error:', e);
    }
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock = null;
      }
    } catch (e) {}
    this.clearAuth();
    this.status = 'DISCONNECTED';
    this.connectedNumber = null;
    this.linkedAt = null;
    this.qrDataUrl = null;
    this.isInitializing = false;
    this.init();
    return { success: true, message: 'Logged out successfully' };
  }

  async refreshQR() {
    try {
      if (this.status === 'CONNECTED') {
        return { success: true, message: 'Already connected', status: this.getStatus() };
      }
      this.clearAuth();
      if (this.sock) {
        try {
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }
      this.qrDataUrl = null;
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
      await this.init();
      let count = 0;
      while (count < 20 && !this.qrDataUrl && this.status !== 'CONNECTED') {
        await new Promise(r => setTimeout(r, 200));
        count++;
      }
      return { success: true, status: this.getStatus() };
    } catch (err) {
      console.error('[WhatsApp Service] Refresh QR error:', err);
      throw err;
    }
  }

  async requestPairingCode(rawPhone) {
    let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Invalid destination phone number. Please enter a valid 10-digit mobile number.');
    }

    if (this.status === 'CONNECTED') {
      throw new Error('WhatsApp is already connected. Please disconnect first to link another device.');
    }

    if (!this.sock || typeof this.sock.requestPairingCode !== 'function' || !this.sock.ws?.isOpen) {
      this.isInitializing = false;
      await this.init();
      let waited = 0;
      while ((!this.sock || typeof this.sock.requestPairingCode !== 'function') && waited < 4000) {
        await new Promise(r => setTimeout(r, 400));
        waited += 400;
      }
    }

    if (this.sock?.waitForSocketOpen) {
      try {
        await this.sock.waitForSocketOpen();
      } catch (e) {}
    }

    if (!this.sock || typeof this.sock.requestPairingCode !== 'function') {
      throw new Error('WhatsApp service is initializing. Please wait 3 seconds and try again.');
    }

    try {
      const code = await this.sock.requestPairingCode(cleanPhone);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      return { success: true, pairingCode: formattedCode, rawCode: code };
    } catch (err) {
      console.error('[WhatsApp Service] Pairing code error:', err);
      this.clearAuth();
      this.isInitializing = false;
      await this.init();
      let waited = 0;
      while ((!this.sock || typeof this.sock.requestPairingCode !== 'function') && waited < 4000) {
        await new Promise(r => setTimeout(r, 400));
        waited += 400;
      }
      if (this.sock?.waitForSocketOpen) {
        try { await this.sock.waitForSocketOpen(); } catch (e) {}
      }
      if (this.sock && typeof this.sock.requestPairingCode === 'function') {
        const code = await this.sock.requestPairingCode(cleanPhone);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        return { success: true, pairingCode: formattedCode, rawCode: code };
      }
      throw new Error(err?.message || 'Failed to generate pairing code. Please refresh QR or try again.');
    }
  }

  getStatus() {
    const isActuallyConnected = this.status === 'CONNECTED' && Boolean(this.sock?.user?.id || this.sock?.user);
    const rawJid = isActuallyConnected ? (this.sock?.user?.id || '') : '';
    const phone = isActuallyConnected ? (this.connectedNumber || rawJid.split(':')[0] || rawJid.split('@')[0] || null) : null;
    const { platformName, deviceName } = this.getPlatformInfo();

    if (!isActuallyConnected && !this.sock && !this.isInitializing) {
      this.init().catch(() => {});
    }

    return {
      status: isActuallyConnected ? 'CONNECTED' : (this.qrDataUrl ? 'SCAN_QR' : this.status),
      connectedNumber: phone,
      userName: isActuallyConnected ? (this.sock?.user?.name || this.restaurantName || 'MS Billings User') : null,
      restaurantName: this.restaurantName || null,
      platform: platformName,
      deviceName: deviceName,
      linkedAt: isActuallyConnected ? (this.linkedAt || new Date().toISOString()) : null,
      linkedDevices: isActuallyConnected && phone ? [
        {
          id: 'dev_1',
          name: deviceName,
          platform: `${platformName} Gateway`,
          status: 'Active',
          lastActive: 'Just now',
          phoneNumber: `+${phone}`
        }
      ] : [],
      totalLinkedDevices: isActuallyConnected && phone ? 1 : 0,
      hasQr: Boolean(this.qrDataUrl && !isActuallyConnected),
      qr: isActuallyConnected ? null : this.qrDataUrl
    };
  }

  notifyListeners() {
    const data = this.getStatus();
    this.connectionListeners.forEach(listener => {
      try {
        listener(data);
      } catch (e) {}
    });
  }

  addListener(fn) {
    this.connectionListeners.add(fn);
    return () => this.connectionListeners.delete(fn);
  }

  async ensureConnection() {
    const isReady = this.status === 'CONNECTED' && Boolean(this.sock?.user?.id || this.sock?.user) && this.sock?.ws?.isOpen;
    if (!isReady) {
      console.log('[WhatsApp Service] Ensuring socket connection is open and user is verified...');
      if (!this.sock || this.status === 'DISCONNECTED') {
        this.isInitializing = false;
        await this.init();
      }
      if (this.sock?.waitForSocketOpen) {
        try {
          await this.sock.waitForSocketOpen();
        } catch (e) {}
      }
      let count = 0;
      while (count < 30 && (this.status !== 'CONNECTED' || !this.sock?.user?.id)) {
        await new Promise(r => setTimeout(r, 200));
        count++;
      }
    }
  }

  async sendMessage(rawPhone, text) {
    let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Invalid destination phone number. Please enter a 10-digit mobile number.');
    }

    await this.ensureConnection();

    if (!this.sock || this.status !== 'CONNECTED' || !this.sock?.user?.id) {
      throw new Error('WhatsApp service is not connected. Please scan the QR code or link via phone code.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      if (this.sock.waitForSocketOpen) {
        try { await this.sock.waitForSocketOpen(); } catch (e) {}
      }
      const result = await this.sock.sendMessage(jid, { text: String(text) });
      return result;
    } catch (sendErr) {
      console.warn('[WhatsApp Service] Send failed, retrying once after reconnect...', sendErr);
      this.isInitializing = false;
      await this.init();
      if (this.sock?.waitForSocketOpen) {
        try { await this.sock.waitForSocketOpen(); } catch (e) {}
      }
      if (this.sock && this.sock.user?.id) {
        return await this.sock.sendMessage(jid, { text: String(text) });
      }
      throw sendErr;
    }
  }

  async sendBillMedia(rawPhone, { imageBase64, pdfBase64, documentBase64, mimetype, caption, fileName }) {
    let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Invalid destination phone number. Please enter a 10-digit mobile number.');
    }

    await this.ensureConnection();

    if (!this.sock || this.status === 'DISCONNECTED') {
      throw new Error('WhatsApp service is not connected. Please scan the QR code or link via phone code.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    const sendAction = async () => {
      if (this.sock?.waitForSocketOpen) {
        try { await this.sock.waitForSocketOpen(); } catch (e) {}
      }
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        return await this.sock.sendMessage(jid, {
          image: buffer,
          mimetype: 'image/jpeg',
          caption: caption || '🧾 *Your Digital e-Bill Receipt*'
        });
      } else if (pdfBase64 || documentBase64) {
        const srcBase64 = documentBase64 || pdfBase64;
        const cleanBase64 = srcBase64.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        return await this.sock.sendMessage(jid, {
          document: buffer,
          mimetype: mimetype || (pdfBase64 ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          fileName: fileName || (pdfBase64 ? 'Receipt.pdf' : 'DayBook.xlsx'),
          caption: caption || '🧾 *Document*'
        });
      } else {
        return await this.sock.sendMessage(jid, { text: caption || '🧾 *Your Digital e-Bill Receipt*' });
      }
    };

    try {
      return await sendAction();
    } catch (sendErr) {
      console.warn('[WhatsApp Service] Media upload failed, falling back to instant formatted text:', sendErr?.message);
      try {
        return await this.sock.sendMessage(jid, { text: caption || '🧾 *Your Digital e-Bill Receipt*' });
      } catch (fallbackErr) {
        console.warn('[WhatsApp Service] Connection dropped during fallback. Re-initializing & retrying once...');
        this.isInitializing = false;
        await this.init();
        if (this.sock?.waitForSocketOpen) {
          try { await this.sock.waitForSocketOpen(); } catch (e) {}
        }
        if (this.sock) {
          return await this.sock.sendMessage(jid, { text: caption || '🧾 *Your Digital e-Bill Receipt*' });
        }
        throw fallbackErr;
      }
    }
  }
}

class WhatsAppManager {
  constructor() {
    this.instances = new Map();
  }

  getInstance(tenantId = 'default', restaurantName = null) {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, new WhatsAppService(tenantId, restaurantName));
    } else if (restaurantName) {
      this.instances.get(tenantId).setRestaurantName(restaurantName);
    }
    return this.instances.get(tenantId);
  }
}

const whatsappManager = new WhatsAppManager();
export default whatsappManager;
