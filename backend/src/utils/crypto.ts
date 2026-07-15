import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a Buffer containing the IV, auth tag, and ciphertext.
 */
export function encrypt(text: string): Buffer {
  // Key must be exactly 32 bytes for aes-256
  const key = crypto.scryptSync(env.ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv (12 bytes), tag (16 bytes), and ciphertext
  return Buffer.concat([iv, tag, ciphertext]);
}

/**
 * Decrypts a buffer containing IV, auth tag, and ciphertext using AES-256-GCM.
 */
export function decrypt(encryptedBuffer: Buffer): string {
  const key = crypto.scryptSync(env.ENCRYPTION_KEY, 'salt', 32);
  
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const tag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
