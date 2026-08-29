import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, '..', 'auth_info_baileys');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.qrDataUrl = null;
    this.status = 'DISCONNECTED'; // 'DISCONNECTED', 'SCAN_QR', 'CONNECTING', 'CONNECTED'
    this.connectedNumber = null;
    this.connectionListeners = new Set();
    this.isInitializing = false;
  }

  async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      let version;
      try {
        const vInfo = await fetchLatestBaileysVersion();
        version = vInfo.version;
      } catch (e) {
        version = [2, 3000, 1015901307];
      }

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['MS Billings POS', 'Chrome', '1.0.0'],
        syncFullHistory: false
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr);
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
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
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

  getStatus() {
    const rawJid = this.sock?.user?.id || '';
    const phone = this.connectedNumber || rawJid.split(':')[0] || rawJid.split('@')[0];
    const isConnected = this.status === 'CONNECTED' || Boolean(this.sock?.user);

    return {
      status: isConnected ? 'CONNECTED' : this.status,
      connectedNumber: phone || null,
      userName: this.sock?.user?.name || 'MS Billings User',
      linkedAt: this.linkedAt || (isConnected ? new Date().toISOString() : null),
      linkedDevices: isConnected ? [
        {
          id: 'dev_1',
          name: 'Google Chrome (MS Billings POS)',
          platform: 'Windows / Web Gateway',
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

    if (!this.sock) {
      throw new Error('WhatsApp service is not connected. Please scan the QR code in POS Settings.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      if (typeof this.sock.onWhatsApp === 'function') {
        const check = await this.sock.onWhatsApp(cleanPhone);
        if (check && Array.isArray(check) && check.length > 0 && check[0]?.jid) {
          jid = check[0].jid;
        }
      }
    } catch (chkErr) {
      console.warn('[WhatsApp Service] onWhatsApp lookup fallback:', chkErr?.message);
    }

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

    if (!this.sock) {
      throw new Error('WhatsApp service is not connected. Please scan the QR code in POS Settings.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;
    try {
      if (typeof this.sock.onWhatsApp === 'function') {
        const check = await this.sock.onWhatsApp(cleanPhone);
        if (check && Array.isArray(check) && check.length > 0 && check[0]?.jid) {
          jid = check[0].jid;
        }
      }
    } catch (chkErr) {
      console.warn('[WhatsApp Service] onWhatsApp media lookup fallback:', chkErr?.message);
    }

    const sendAction = async () => {
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        return await this.sock.sendMessage(jid, {
          image: buffer,
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
      if (sendErr?.message?.includes('Connection Closed') || sendErr?.message?.includes('closed') || sendErr?.message?.includes('output')) {
        console.warn('[WhatsApp Service] Connection dropped during media send. Re-initializing & retrying once...');
        this.isInitializing = false;
        await this.init();
        await new Promise(r => setTimeout(r, 2000));
        if (this.sock) {
          return await sendAction();
        }
      }
      throw sendErr;
    }
  }
}

const whatsappService = new WhatsAppService();
export default whatsappService;
