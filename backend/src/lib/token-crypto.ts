import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { loadEnv } from './env';

/**
 * Symmetric encryption for secrets we must store and later reuse - currently the
 * Gmail OAuth refresh token (Stage 14). AES-256-GCM (authenticated) so a
 * tampered ciphertext fails to decrypt rather than yielding garbage. The key is
 * `GMAIL_TOKEN_ENC_KEY` (base64 → exactly 32 bytes); generate with
 * `openssl rand -base64 32`.
 *
 * Ciphertext layout, base64-encoded for storage: `iv(12) | authTag(16) | data`.
 * A fresh random IV per call means encrypting the same token twice differs, and
 * GCM's tag is verified on decrypt.
 */

const IV_BYTES = 12; // 96-bit nonce is the GCM standard
const TAG_BYTES = 16;

/** Load + validate the 32-byte key, or throw a clear config error. */
function loadKey(): Buffer {
  const raw = loadEnv().GMAIL_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error('GMAIL_TOKEN_ENC_KEY is not set (openssl rand -base64 32).');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `GMAIL_TOKEN_ENC_KEY must decode to 32 bytes (got ${key.length}); use \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

/** True when a usable encryption key is configured (feature-gate helper). */
export function tokenCryptoReady(): boolean {
  const raw = loadEnv().GMAIL_TOKEN_ENC_KEY;
  if (!raw) return false;
  return Buffer.from(raw, 'base64').length === 32;
}

/** Encrypt a UTF-8 secret → base64 `iv|tag|ciphertext`. */
export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypt a value produced by `encryptToken`; throws if the key or data is bad. */
export function decryptToken(packed: string): string {
  const key = loadKey();
  const buf = Buffer.from(packed, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Encrypted token is malformed (too short).');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
