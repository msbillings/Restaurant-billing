import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encryptBackup, decryptBackup } from '../../utils/cryptoUtil.js';
import mongoose from 'mongoose';

describe('Phase 4: Backup, Crypto, and Restore Architecture', () => {
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  
  beforeAll(() => {
    process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY;
  });

  describe('Cryptography Engine', () => {
    it('should correctly encrypt and decrypt a JSON payload', () => {
      const payload = { test: 'data', secret: 'value' };
      const encrypted = encryptBackup(payload);
      expect(Buffer.isBuffer(encrypted)).toBe(true);
      
      const decrypted = decryptBackup(encrypted);
      expect(JSON.parse(decrypted)).toEqual(payload);
    });

    it('should reject tampered ciphertext', () => {
      const payload = { data: 'important' };
      const encrypted = encryptBackup(payload);
      
      // Tamper with the ciphertext (last byte)
      encrypted[encrypted.length - 1] = encrypted[encrypted.length - 1] ^ 0xFF;
      
      expect(() => decryptBackup(encrypted)).toThrow(/tampered payload/i);
    });

    it('should reject invalid key length', () => {
      process.env.BACKUP_ENCRYPTION_KEY = 'shortkey';
      expect(() => encryptBackup({ data: 'test' })).toThrow(/32 bytes/);
      process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY; // restore
    });
  });
});
