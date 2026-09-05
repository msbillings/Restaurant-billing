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
  if (!sock) return false;
  if (sock.ws) {
    if (sock.ws.socket && typeof sock.ws.socket.readyState === 'number') {
      return sock.ws.socket.readyState === 1;
    }
    if (typeof sock.ws.readyState === 'number') {
      return sock.ws.readyState === 1;
    }
    if (sock.ws.isOpen === true) return true;
  }
  // Do NOT fall back to sock.user?.id alone — a stale socket keeps user.id
  // but the WebSocket is already CLOSED, causing 'Cannot read attrs' errors.
  return false;
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
    this._initPromise = null; // Promise-based lock: prevents concurrent init() calls
    this.authState = null;
    this.heartbeatInterval = null;
    this._conflictCount = 0;
    this.startBackgroundHeartbeat();
  }

  startBackgroundHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Skip heartbeat if init is already running — avoids race condition with reconnect
        if (this._initPromise) return;
        if (this.status === 'CONNECTED' && (!this.sock || !isSocketOpen(this.sock))) {
          console.log(`[WhatsApp Service - ${this.tenantId}] 24/7 Heartbeat detected socket drop! Auto-reconnecting...`);
          await this.ensureConnection(true);
        }
      } catch (e) {
        console.warn(`[WhatsApp Service - ${this.tenantId}] Heartbeat check warning:`, e?.message);
      }
    }, 15000); // Increased from 10s to 15s to reduce heartbeat pressure
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
    // Promise-based lock: if init is already running, WAIT for it instead of starting a second socket
    if (this._initPromise) {
      console.log(`[WhatsApp - ${this.tenantId}] init() called while already initializing — waiting for existing init...`);
      return this._initPromise;
    }
    if (this.status === 'CONNECTED' && this.sock?.user?.id && isSocketOpen(this.sock)) {
      return;
    }
    this.isInitializing = true;
    this._initPromise = this._doInit();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
      this.isInitializing = false;
    }
  }

  async _doInit() {
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
        const vInfo = await Promise.race([
          fetchLatestBaileysVersion(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('version fetch timeout')), 1500))
        ]);
        version = vInfo.version;
      } catch (e) {
        version = [2, 3000, 1043857760];
      }

      const platformInfo = this.getPlatformInfo();

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: platformInfo.browserConfig,
        syncFullHistory: false,
        markOnlineOnConnect: false,         // Do NOT mark online — reduces conflict triggers
        generateHighQualityLinkPreview: false, // Reduces server-side processing
        connectTimeoutMs: 20000,
        defaultQueryTimeoutMs: 20000,
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
            console.log(`[WhatsApp Diagnostics - ${this.tenantId}] QR code generated. Status set to SCAN_QR`);
            this.notifyListeners();
          } catch (qrErr) {
            console.error('[WhatsApp Service] QR Generation Error:', qrErr);
          }
        }

        if (connection === 'connecting') {
          this.status = 'CONNECTING';
          this.qrDataUrl = null;
          console.log(`[WhatsApp Diagnostics - ${this.tenantId}] Connecting to WhatsApp servers...`);
          this.notifyListeners();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const errorPayload = (lastDisconnect?.error)?.output?.payload;
          const errorMessage = lastDisconnect?.error?.message;
          console.warn(`[WhatsApp Diagnostics - ${this.tenantId}] Connection CLOSED! Code: ${statusCode}, Reason: "${errorMessage || errorPayload?.error || 'Unknown'}"`);

          const isConflict = statusCode === 440;
          const isExplicitLoggedOut = statusCode === DisconnectReason.loggedOut && 
            (errorPayload?.error === 'Unauthorized' || String(errorMessage).toLowerCase().includes('logged out'));
          const isRestartRequired = statusCode === 515 || statusCode === DisconnectReason.restartRequired || statusCode === 401 || statusCode === 408;
          
          if (isExplicitLoggedOut) {
            console.log(`[WhatsApp Diagnostics - ${this.tenantId}] Logged out explicitly. Clearing credentials...`);
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
              this._initPromise = null;
              this.isInitializing = false;
              this.init();
            }, 2000);
          } else if (isConflict) {
            // Code 440: WhatsApp server kicked us out due to a session conflict.
            // Wait before reconnecting so the old session expires on WhatsApp's end.
            this._conflictCount = (this._conflictCount || 0) + 1;
            const conflictDelay = Math.min(8000 + (this._conflictCount - 1) * 3000, 20000);
            console.log(`[WhatsApp Diagnostics - ${this.tenantId}] Code 440 conflict #${this._conflictCount} — waiting ${conflictDelay}ms before reconnect...`);
            this.status = 'CONNECTING';
            this.notifyListeners();
            setTimeout(() => {
              this._initPromise = null;
              this.isInitializing = false;
              this.init();
            }, conflictDelay);
          } else {
            console.log(`[WhatsApp Diagnostics - ${this.tenantId}] Auto-reconnecting background socket (statusCode: ${statusCode})...`);
            this.status = isRestartRequired ? 'CONNECTING' : 'DISCONNECTED';
            this.notifyListeners();

            const delay = isRestartRequired ? 600 : 2000;
            setTimeout(() => {
              this._initPromise = null;
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
          // Reset conflict counter on successful connection
          this._conflictCount = 0;
          console.log(`[WhatsApp Diagnostics - ${this.tenantId}] Connected successfully 24/7 as +${this.connectedNumber} (${platformInfo.deviceName})`);
          this.notifyListeners();

          // NOTE: updateProfileName removed — it was triggering Code 440 stream conflicts
          // on every reconnect by sending a server-side profile update that conflicted with the session.

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
        }
      });
    } catch (err) {
      console.error(`[WhatsApp Diagnostics - ${this.tenantId}] Init error:`, err);
      this.status = 'DISCONNECTED';
      this.notifyListeners();
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
      this.qrDataUrl = null;
      this.status = 'DISCONNECTED';
      this.connectedNumber = null;
      this.clearAuth();
      this.notifyListeners();
      return { success: true, message: 'Logged out successfully' };
    } catch (err) {
      console.error('[WhatsApp Service] Logout error:', err);
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

  async ensureConnection(forceReconnect = false) {
    const wsState = this.sock?.ws?.socket?.readyState ?? this.sock?.ws?.readyState ?? 'none';
    const isReady = (this.status === 'CONNECTED' || Boolean(this.sock?.user?.id)) && isSocketOpen(this.sock);
    
    if (!forceReconnect && isReady) {
      return;
    }

    console.log(`[WhatsApp Diagnostics - ${this.tenantId}] Ensuring socket readiness... (forceReconnect: ${forceReconnect}, status: ${this.status}, ws readyState: ${wsState})`);
    
    if (forceReconnect || !this.sock || !isSocketOpen(this.sock) || this.status === 'DISCONNECTED') {
      this.isInitializing = false;
      await this.init();
    }
    
    // Wait up to 10 seconds for WebSocket handshake to reach OPEN state (readyState 1)
    let count = 0;
    while (count < 50) {
      if ((this.status === 'CONNECTED' || Boolean(this.sock?.user?.id)) && isSocketOpen(this.sock)) {
        console.log(`[WhatsApp Diagnostics - ${this.tenantId}] Socket is now OPEN & READY!`);
        return;
      }
      await new Promise(r => setTimeout(r, 200));
      count++;
    }
    console.warn(`[WhatsApp Diagnostics - ${this.tenantId}] Socket readiness wait completed after 10s. Current status: ${this.status}`);
  }

  async sendMessage(rawPhone, text) {
    let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Invalid destination phone number.');
    }

    await this.ensureConnection();

    if (!this.sock || !this.sock.user?.id || !isSocketOpen(this.sock)) {
      // Auto-attempt force reconnect once before erroring out
      console.warn(`[WhatsApp Diagnostics - ${this.tenantId}] Socket not open before sendMessage. Triggering forceReconnect...`);
      await this.ensureConnection(true);
    }

    if (!this.sock || !this.sock.user?.id || !isSocketOpen(this.sock)) {
      throw new Error('WhatsApp bot connection is opening. Please try sending again in 2 seconds.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      const result = await Promise.race([
        this.sock.sendMessage(jid, { text: String(text) }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Message send timed out on WhatsApp server')), 15000))
      ]);
      return result;
    } catch (sendErr) {
      console.warn('[WhatsApp Diagnostics] Send message warning:', sendErr?.message || sendErr);
      const errStr = String(sendErr?.message || sendErr).toLowerCase();
      const isAttrsError = errStr.includes('attrs') || errStr.includes('cannot read properties');
      const needsReconnect = isAttrsError || errStr.includes('closed') || errStr.includes('disconnect') ||
        errStr.includes('not connected') || errStr.includes('500') || errStr.includes('timed out');

      if (needsReconnect) {
        if (isAttrsError) {
          console.log('[sendMessage] Detected Baileys stale-socket (attrs) error — doing FULL teardown + reinit...');
          try {
            if (this.sock) { this.sock.ev.removeAllListeners(); this.sock.end(undefined); }
          } catch (e) {}
          this.sock = null;
          this.isInitializing = false;
          this.status = 'DISCONNECTED';
        }
        try {
          await this.ensureConnection(true);
          await new Promise(r => setTimeout(r, 1500));
          if (this.sock && isSocketOpen(this.sock)) {
            return await Promise.race([
              this.sock.sendMessage(jid, { text: String(text) }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Message send timed out on retry')), 20000))
            ]);
          }
        } catch (retryErr) {
          console.warn('[WhatsApp Diagnostics] Retry text send error:', retryErr?.message);
          throw retryErr;
        }
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

    console.log(`[sendBillMedia] ▶ Starting for phone=${cleanPhone} | hasImage=${!!imageBase64} | hasPdf=${!!pdfBase64} | hasDoc=${!!documentBase64}`);

    await this.ensureConnection();

    const wsStateA = this.sock?.ws?.socket?.readyState ?? this.sock?.ws?.readyState ?? 'none';
    console.log(`[sendBillMedia] After ensureConnection: status=${this.status} | ws.readyState=${wsStateA} | user=${this.sock?.user?.id || 'none'}`);

    if (!this.sock || !this.sock.user?.id || !isSocketOpen(this.sock)) {
      console.warn(`[sendBillMedia] Socket not open — triggering forceReconnect...`);
      await this.ensureConnection(true);
    }

    const wsStateB = this.sock?.ws?.socket?.readyState ?? this.sock?.ws?.readyState ?? 'none';
    console.log(`[sendBillMedia] After forceReconnect check: status=${this.status} | ws.readyState=${wsStateB} | user=${this.sock?.user?.id || 'none'}`);

    if (!this.sock || !this.sock.user?.id || !isSocketOpen(this.sock)) {
      throw new Error('WhatsApp bot connection is opening. Please try sending again in 2 seconds.');
    }

    let jid = `${cleanPhone}@s.whatsapp.net`;
    console.log(`[sendBillMedia] Sending to JID: ${jid}`);

    let messagePayload = {};
    const isImage = Boolean(imageBase64);
    if (pdfBase64 || (documentBase64 && (mimetype?.includes('pdf') || fileName?.endsWith('.pdf')))) {
      const rawB64 = (pdfBase64 || documentBase64).replace(/^data:application\/pdf;base64,/, '').trim();
      const buffer = Buffer.from(rawB64, 'base64');
      console.log(`[sendBillMedia] Payload type=PDF | bufferKB=${Math.round(buffer.length / 1024)}`);
      messagePayload = {
        document: buffer,
        mimetype: mimetype || 'application/pdf',
        fileName: fileName || 'eBill.pdf',
        caption: caption || ''
      };
    } else if (imageBase64) {
      const rawB64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
      const buffer = Buffer.from(rawB64, 'base64');
      console.log(`[sendBillMedia] Payload type=IMAGE | bufferKB=${Math.round(buffer.length / 1024)}`);
      messagePayload = {
        image: buffer,
        mimetype: mimetype || 'image/jpeg',
        caption: caption || ''
      };
    } else if (documentBase64) {
      const rawB64 = documentBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const buffer = Buffer.from(rawB64, 'base64');
      console.log(`[sendBillMedia] Payload type=DOCUMENT | bufferKB=${Math.round(buffer.length / 1024)}`);
      messagePayload = {
        document: buffer,
        mimetype: mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: fileName || 'SalesReport.xlsx',
        caption: caption || ''
      };
    } else {
      console.log(`[sendBillMedia] Payload type=TEXT (no media provided)`);
      messagePayload = { text: caption || '🧾 *Your Digital e-Bill Receipt*' };
    }

    try {
      const timeoutMs = isImage ? 35000 : 40000;
      console.log(`[sendBillMedia] Calling sock.sendMessage | timeoutMs=${timeoutMs}...`);
      const result = await Promise.race([
        this.sock.sendMessage(jid, messagePayload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Media send timed out on WhatsApp server')), timeoutMs))
      ]);
      console.log(`[sendBillMedia] ✅ sock.sendMessage succeeded! messageID=${result?.key?.id || 'N/A'}`);
      return result;
    } catch (sendErr) {
      // Normalize: Baileys sometimes rejects with non-Error (undefined, string, object)
      const errMsg = sendErr?.message || (typeof sendErr === 'string' ? sendErr : '') || 'Connection Closed';
      const normalizedErr = sendErr instanceof Error ? sendErr : new Error(errMsg);
      console.error(`[sendBillMedia] ❌ sock.sendMessage FAILED: ${errMsg}`);
      console.error(`[sendBillMedia] Error stack:`, normalizedErr?.stack);
      const errStr = errMsg.toLowerCase();

      // --- The 'attrs' error means Baileys internal state is broken (stale socket). ---
      const isAttrsError = errStr.includes('attrs') || errStr.includes('cannot read properties');
      const needsReconnect = isAttrsError || errStr.includes('closed') || errStr.includes('disconnect') ||
        errStr.includes('not connected') || errStr.includes('500') || errStr.includes('timed out') ||
        errStr.includes('terminated') || errStr === 'connection closed' || !sendErr?.message;

      if (needsReconnect) {
        if (isAttrsError) {
          console.log('[sendBillMedia] Detected Baileys stale-socket (attrs) error — doing FULL teardown + reinit...');
          try {
            if (this.sock) { this.sock.ev.removeAllListeners(); this.sock.end(undefined); }
          } catch (e) {}
          this.sock = null;
          this._initPromise = null;
          this.isInitializing = false;
          this.status = 'DISCONNECTED';
        } else {
          console.log(`[sendBillMedia] Socket error (${errMsg}) — auto-reconnecting & retrying...`);
        }

        try {
          await this.ensureConnection(true);
          // Wait a moment for socket to fully stabilize after reinit
          await new Promise(r => setTimeout(r, 1500));
          if (this.sock && isSocketOpen(this.sock)) {
            const retryTimeoutMs = isImage ? 40000 : 50000;
            console.log(`[sendBillMedia] Retry attempt | retryTimeoutMs=${retryTimeoutMs}...`);
            const retryResult = await Promise.race([
              this.sock.sendMessage(jid, messagePayload),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Media send timed out on retry')), retryTimeoutMs))
            ]);
            console.log(`[sendBillMedia] ✅ Retry succeeded! messageID=${retryResult?.key?.id || 'N/A'}`);
            return retryResult;
          } else {
            throw new Error('WhatsApp socket not ready after reconnect. Please try again in a few seconds.');
          }
        } catch (retryErr) {
          console.error(`[sendBillMedia] ❌ Retry FAILED: ${retryErr?.message}`);
          console.error(`[sendBillMedia] Retry stack:`, retryErr?.stack);
          throw retryErr;
        }
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
