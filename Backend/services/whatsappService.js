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

function getAuthDir() {
  if (process.env.APP_USER_DATA_PATH) {
    const dir = path.join(process.env.APP_USER_DATA_PATH, 'auth_info_baileys');
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (e) {
      console.warn('[WhatsApp Service] Failed to create dir in APP_USER_DATA_PATH, using fallback:', e);
    }
  }

  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    const dir = path.join(os.tmpdir(), 'auth_info_baileys');
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (e) {}
  }

  // Development / Standard directory
  const localDir = path.join(__dirname, '..', 'auth_info_baileys');
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    // Verify write permissions
    const testFile = path.join(localDir, '.write_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return localDir;
  } catch (e) {
    // If packaged in read-only path (e.g. Program Files), fallback to OS temp or home directory
    const fallbackDir = path.join(os.tmpdir(), 'msbilling_baileys_auth');
    try {
      if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
      return fallbackDir;
    } catch (err) {
      return localDir;
    }
  }
}

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.qrDataUrl = null;
    this.status = 'DISCONNECTED'; // 'DISCONNECTED', 'SCAN_QR', 'CONNECTING', 'CONNECTED'
    this.connectedNumber = null;
    this.connectionListeners = new Set();
    this.isInitializing = false;
    this.authDir = getAuthDir();
  }

  getPlatformInfo() {
    const plt = os.platform();
    if (plt === 'win32') {
      return {
        browserConfig: Browsers.windows('Chrome'),
        platformName: 'Windows',
        deviceName: 'MS Billings POS (Windows)'
      };
    } else if (plt === 'darwin') {
      return {
        browserConfig: Browsers.macOS('Chrome'),
        platformName: 'Mac OS',
        deviceName: 'MS Billings POS (Mac OS)'
      };
    } else if (plt === 'android') {
      return {
        browserConfig: ['Chrome', 'Android', '120.0.0'],
        platformName: 'Android',
        deviceName: 'MS Billings POS (Android APK)'
      };
    } else {
      return {
        browserConfig: Browsers.ubuntu('Chrome'),
        platformName: 'Linux / Ubuntu',
        deviceName: 'MS Billings POS (Linux)'
      };
    }
  }

  async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      this.authDir = getAuthDir();
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      let version;
      try {
        const vInfo = await fetchLatestBaileysVersion();
        version = vInfo.version;
      } catch (e) {
        version = [2, 3000, 1015901307];
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

      this.sock.ev.on('creds.update', saveCreds);

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
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          this.status = 'DISCONNECTED';
          this.connectedNumber = null;
          this.notifyListeners();

          if (shouldReconnect) {
            console.log('[WhatsApp Service] Reconnecting...');
            setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, 3000);
          } else {
            console.log('[WhatsApp Service] Logged out. Clearing credentials...');
            this.clearAuth();
            setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, 2000);
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrDataUrl = null;
          this.linkedAt = this.linkedAt || new Date().toISOString();
          const rawJid = this.sock.user?.id || '';
          this.connectedNumber = rawJid.split(':')[0] || rawJid.split('@')[0];
          console.log(`[WhatsApp Service] Connected successfully as +${this.connectedNumber}`);
          this.notifyListeners();
        } else if (connection === 'connecting') {
          this.status = 'CONNECTING';
          this.notifyListeners();
        }
      });
    } catch (err) {
      console.error('[WhatsApp Service] Init error:', err);
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
    const rawJid = this.sock?.user?.id || '';
    const phone = this.connectedNumber || rawJid.split(':')[0] || rawJid.split('@')[0];
    const isConnected = this.status === 'CONNECTED' || Boolean(this.sock?.user);
    const { platformName, deviceName } = this.getPlatformInfo();

    return {
      status: isConnected ? 'CONNECTED' : this.status,
      connectedNumber: phone || null,
      userName: this.sock?.user?.name || 'MS Billings User',
      platform: platformName,
      deviceName: deviceName,
      linkedAt: this.linkedAt || (isConnected ? new Date().toISOString() : null),
      linkedDevices: isConnected ? [
        {
          id: 'dev_1',
          name: deviceName,
          platform: `${platformName} Gateway`,
          status: 'Active',
          lastActive: 'Just now',
          phoneNumber: phone ? `+${phone}` : ''
        }
      ] : [],
      totalLinkedDevices: isConnected ? 1 : 0,
      hasQr: Boolean(this.qrDataUrl),
      qr: isConnected ? null : this.qrDataUrl
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
    if (!this.sock || this.status === 'DISCONNECTED') {
      console.log('[WhatsApp Service] Connection inactive. Attempting fast reconnection...');
      this.isInitializing = false;
      await this.init();
      let count = 0;
      while (count < 15 && this.status !== 'CONNECTED') {
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

    if (!this.sock || !this.sock.user || !this.sock.user.id) {
      throw new Error('WhatsApp service is not connected. Please scan the QR code in POS Settings.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      const result = await this.sock.sendMessage(jid, { text: String(text) });
      return result;
    } catch (sendErr) {
      if (sendErr?.message?.includes('Connection Closed') || sendErr?.message?.includes('closed') || sendErr?.message?.includes('output')) {
        console.warn('[WhatsApp Service] Connection dropped during send. Re-initializing & retrying once...');
        this.isInitializing = false;
        await this.init();
        await new Promise(r => setTimeout(r, 2000));
        if (this.sock) {
          return await this.sock.sendMessage(jid, { text: String(text) });
        }
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

    if (!this.sock || !this.sock.user || !this.sock.user.id) {
      throw new Error('WhatsApp service is not connected. Please scan the QR code in POS Settings.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    const sendAction = async () => {
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
        if (fallbackErr?.message?.includes('Connection Closed') || fallbackErr?.message?.includes('closed') || fallbackErr?.message?.includes('output')) {
          console.warn('[WhatsApp Service] Connection dropped during fallback. Re-initializing & retrying once...');
          this.isInitializing = false;
          await this.init();
          await new Promise(r => setTimeout(r, 2000));
          if (this.sock) {
            return await this.sock.sendMessage(jid, { text: caption || '🧾 *Your Digital e-Bill Receipt*' });
          }
        }
        throw fallbackErr;
      }
    }
  }
}

const whatsappService = new WhatsAppService();
export default whatsappService;
