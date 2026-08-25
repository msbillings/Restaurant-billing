import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

export const initFirebase = () => {
  try {
    const serviceAccountPath = path.resolve('firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      global.firebaseAdmin = admin;
      console.log('[Firebase] Admin SDK initialized successfully.');
    } else {
      console.warn('[Firebase] Warning: firebase-service-account.json not found. Push notifications will be disabled.');
    }
  } catch (error) {
    console.error('[Firebase] Failed to initialize Admin SDK:', error.message);
  }
};
