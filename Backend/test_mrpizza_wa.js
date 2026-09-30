import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}
import makeWASocket, { DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import { useMongoDBAuthState } from './utils/useMongoDBAuthState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkMrPizza() {
  const uri = process.env.MONGO_URI.replace('/mscurechain?', '/client_mrpizzahotandfresh_6a9927?');
  console.log('[Testing] Connecting directly to DB for Mr Pizza...');
  const conn = await mongoose.createConnection(uri).asPromise();
  
  // useMongoDBAuthState uses the model, so we need to pass a Mongoose model
  const authSchema = new mongoose.Schema({ id: String, data: String });
  const WA = conn.model('WhatsAppAuth', authSchema);
  
  console.log('[Testing] Fetching WhatsApp auth state from DB...');
  const { state, saveCreds } = await useMongoDBAuthState(WA);
  
  console.log('[Testing] Starting socket connection to WhatsApp servers (headless)...');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.windows('Chrome'),
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false
  });
  
  sock.ev.on('creds.update', saveCreds);

  let timer = setTimeout(() => {
    console.log('❌ Connection timeout after 15 seconds. WhatsApp is not responding.');
    process.exit(1);
  }, 15000);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      clearTimeout(timer);
      const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      console.log(`❌ Connection closed. Logged out: ${isLoggedOut}. Reason:`, lastDisconnect?.error?.message);
      process.exit(1);
    } else if (connection === 'open') {
      clearTimeout(timer);
      console.log('\n======================================');
      console.log(`✅ SUCCESS: Mr Pizza WhatsApp is TRULY CONNECTED!`);
      console.log(`WhatsApp Phone ID: ${sock.user?.id}`);
      console.log(`WhatsApp Name: ${sock.user?.name || 'N/A'}`);
      console.log('======================================\n');
      process.exit(0);
    }
  });
}
checkMrPizza().catch(console.error);
