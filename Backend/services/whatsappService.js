import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import os from 'os';
import { getTenantModels } from '../utils/tenantManager.js';
import { useMongoDBAuthState } from '../utils/useMongoDBAuthState.js';

const isSocketOpen = (sock) => {
  if (!sock || !sock.ws) return false;
  return sock.ws.readyState === 1 || sock.ws.isOpen === true;
};

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
    this.authState = null;
  }

  setRestaurantName(name) {
    if (name && typeof name === 'string' && name.trim()) {
      this.restaurantName = name.trim();
    }
  }

  getPlatformInfo() {
    const rawName = this.restaurantName || 'MS Billings POS';
    // ALWAYS identify as Windows Chrome so phone Linked Devices displays "Google Chrome (Windows)"
    const browserConfig = Browsers.windows('Chrome');
    
    return {
      browserConfig,
      platformName: rawName,
      deviceName: `${rawName} Gateway`
    };
  }

  async init() {
    if (this.isInitializing) return;
    if (this.status === 'CONNECTED' && this.sock?.user?.id && isSocketOpen(this.sock)) {
      return;
    }
    this.isInitializing = true;

    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }

      const models = await getTenantModels(this.tenantId);
      const WhatsAppAuthModel = models.WhatsAppAuth;
      
      this.authState = await useMongoDBAuthState(WhatsAppAuthModel);
      const { state, saveCreds } = this.authState;
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
          if (this.sock?.user?.id && state?.creds) {
            state.creds.registered = true;
            this.status = 'CONNECTED';
            this.qrDataUrl = null;
            const rawJid = this.sock.user.id;
            this.connectedNumber = rawJid.split(':')[0] || rawJid.split('@')[0] || null;
            this.notifyListeners();
          }
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

        if (connection === 'connecting') {
          this.status = 'CONNECTING';
          this.qrDataUrl = null;
          this.notifyListeners();
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
      if (this.authState && this.authState.clearState) {
        this.authState.clearState();
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

    if (!this.sock || typeof this.sock.requestPairingCode !== 'function' || !isSocketOpen(this.sock)) {
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

  async refreshQR() {
    this.isInitializing = false;
    this.qrDataUrl = null;
    this.status = 'DISCONNECTED';
    await this.init();
    return { success: true, message: 'QR regeneration triggered' };
  }

  getStatus() {
    const isActuallyConnected = (this.status === 'CONNECTED' || Boolean(this.sock?.user?.id)) && isSocketOpen(this.sock);
    const phone = isActuallyConnected ? (this.connectedNumber || (this.sock?.user?.id ? this.sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : null)) : null;
    const { name: deviceName, platform: platformName } = this.getPlatformInfo();

    let currentStatus = this.status;
    if (isActuallyConnected) {
      currentStatus = 'CONNECTED';
    } else if (this.status === 'CONNECTING') {
      currentStatus = 'CONNECTING';
    } else if (this.qrDataUrl) {
      currentStatus = 'SCAN_QR';
    }

    const showQr = Boolean(!isActuallyConnected && currentStatus === 'SCAN_QR' && this.qrDataUrl);

    return {
      status: currentStatus,
      connectedNumber: isActuallyConnected ? phone : null,
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
      hasQr: showQr,
      qr: showQr ? this.qrDataUrl : null
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
    // Zero-delay fast path: already connected and ready
    if ((this.status === 'CONNECTED' || Boolean(this.sock?.user?.id)) && isSocketOpen(this.sock)) {
      return;
    }

    console.log(`[WhatsApp Service - ${this.tenantId}] Ensuring socket connection is open and ready...`);
    if (!this.sock || this.status === 'DISCONNECTED') {
      this.isInitializing = false;
      await this.init();
    }
    if (this.sock?.waitForSocketOpen && !isSocketOpen(this.sock)) {
      try {
        await Promise.race([
          this.sock.waitForSocketOpen(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]);
      } catch (e) {}
    }
    let count = 0;
    while (count < 5 && (this.status !== 'CONNECTED' || !this.sock?.user?.id || !isSocketOpen(this.sock))) {
      await new Promise(r => setTimeout(r, 100));
      count++;
    }
  }

  async sendMessage(rawPhone, text) {
    let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Invalid destination phone number.');
    }

    await this.ensureConnection();

    if (!this.sock || !this.sock.user?.id || !isSocketOpen(this.sock)) {
      throw new Error('WhatsApp service is not connected.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      const result = await this.sock.sendMessage(jid, { text: String(text) });
      return result;
    } catch (sendErr) {
      console.warn('[WhatsApp Service] Send failed, retrying once after reconnect...', sendErr.message);
      this.isInitializing = false;
      await this.init();
      if (this.sock && this.sock.user?.id) {
        return await this.sock.sendMessage(jid, { text: String(text) });
      }
      throw sendErr;
    }
  }

  async sendBillMedia(rawPhone, { imageBase64, pdfBase64, documentBase64, mimetype, caption, fileName }) {
    let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Invalid destination phone number.');
    }

    await this.ensureConnection();

    if (!this.sock || !this.sock.user?.id || !isSocketOpen(this.sock)) {
      throw new Error('WhatsApp service is not connected.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    const sendAction = async () => {
      let messagePayload = {};
      if (pdfBase64 || (documentBase64 && (mimetype?.includes('pdf') || fileName?.endsWith('.pdf')))) {
        const rawB64 = (pdfBase64 || documentBase64).replace(/^data:application\/pdf;base64,/, '').trim();
        const buffer = Buffer.from(rawB64, 'base64');
        messagePayload = {
          document: buffer,
          mimetype: mimetype || 'application/pdf',
          fileName: fileName || 'eBill.pdf',
          caption: caption || ''
        };
      } else if (imageBase64) {
        const rawB64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
        const buffer = Buffer.from(rawB64, 'base64');
        messagePayload = {
          image: buffer,
          mimetype: mimetype || 'image/jpeg',
          caption: caption || ''
        };
      } else if (documentBase64) {
        const rawB64 = documentBase64.replace(/^data:[^;]+;base64,/, '').trim();
        const buffer = Buffer.from(rawB64, 'base64');
        messagePayload = {
          document: buffer,
          mimetype: mimetype || 'application/octet-stream',
          fileName: fileName || 'document',
          caption: caption || ''
        };
      } else {
        messagePayload = { text: caption || '🧾 *Your Digital e-Bill Receipt*' };
      }

      return await this.sock.sendMessage(jid, messagePayload);
    };

    try {
      return await sendAction();
    } catch (sendErr) {
      console.warn('[WhatsApp Service] Media upload attempt failed, retrying media send after reconnect...', sendErr?.message);
      this.isInitializing = false;
      await this.init();
      await this.ensureConnection();
      if (this.sock && isSocketOpen(this.sock)) {
        return await sendAction();
      }
      throw sendErr;
    }
  }
}

class WhatsAppManager {
  constructor() {
    this.instances = new Map();
  }

  hasInstance(tenantId = 'default') {
    return this.instances.has(tenantId);
  }

  getInstance(tenantId = 'default', restaurantName = null) {
    if (!this.instances.has(tenantId)) {
      const instance = new WhatsAppService(tenantId, restaurantName);
      this.instances.set(tenantId, instance);
      // Auto initialize in background so WhatsApp socket is pre-connected & warm
      instance.init().catch(() => {});
    } else if (restaurantName) {
      this.instances.get(tenantId).setRestaurantName(restaurantName);
    }
    return this.instances.get(tenantId);
  }
}

const whatsappManager = new WhatsAppManager();
export default whatsappManager;
