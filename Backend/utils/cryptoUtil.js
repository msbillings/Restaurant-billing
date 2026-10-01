import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 1; // 1 byte version identifier
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Validates and retrieves the encryption key from the environment.
 * @returns {Buffer} 32-byte key
 */
const getKey = () => {
  const hexKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('BACKUP_ENCRYPTION_KEY is not defined in environment');
  }
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return key;
};

/**
 * Encrypts data using AES-256-GCM.
 * Format: [Version: 1 byte] + [IV: 16 bytes] + [AuthTag: 16 bytes] + [Ciphertext]
 * @param {string|Buffer|object} data - Data to encrypt. Objects will be stringified.
 * @returns {Buffer} Encrypted binary payload
 */
export const encryptBackup = (data) => {
  const key = getKey();
  
  let payload;
  if (Buffer.isBuffer(data)) {
    payload = data;
  } else if (typeof data === 'string') {
    payload = Buffer.from(data, 'utf-8');
  } else {
    payload = Buffer.from(JSON.stringify(data), 'utf-8');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const versionBuffer = Buffer.alloc(1);
  versionBuffer.writeUInt8(VERSION, 0);

  // Construct final format
  return Buffer.concat([versionBuffer, iv, authTag, ciphertext]);
};

/**
 * Decrypts a backup payload.
 * @param {Buffer} buffer - The encrypted backup payload
 * @returns {string} Decrypted string payload
 */
export const decryptBackup = (buffer) => {
  const key = getKey();

  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Input must be a Buffer');
  }

  const minLength = 1 + IV_LENGTH + AUTH_TAG_LENGTH;
  if (buffer.length < minLength) {
    throw new Error('Invalid backup file: Payload too short');
  }

  const version = buffer.readUInt8(0);
  if (version !== VERSION) {
    throw new Error(`Unsupported backup version: ${version}`);
  }

  let offset = 1;
  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  
  const authTag = buffer.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;
  
  const ciphertext = buffer.subarray(offset);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (error) {
    throw new Error('Decryption failed: Integrity check failed or incorrect key (tampered payload)');
  }
};
