/**
 * Credential encryption for the analytics hub. One env secret
 * (ANALYTICSHUB_SECRET_KEY = base64 of 32 random bytes) is stretched with HKDF
 * into a domain-separated AES-256-GCM data key; every provider credential stored
 * in Mongo is encrypted with it. The session cookie stays on the existing
 * /seoteam HMAC (SESSION_SECRET) since the hub reuses that login, so this file
 * only needs the one derived key.
 *
 * Ciphertext layout (base64 for storage): `iv(12) | authTag(16) | data` — a fresh
 * random IV per call and GCM's authenticated tag, matching the proven pattern in
 * backend/src/lib/token-crypto.ts. Server-only (node:crypto).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import type { HealthCheck } from "./types";

const IV_BYTES = 12; // 96-bit GCM nonce
const TAG_BYTES = 16;
const HKDF_SALT = Buffer.from("analyticshub.v1", "utf8");
const DATA_KEY_INFO = "analyticshub:data-encryption:v1";

function rawSecret(): string | undefined {
  return process.env.ANALYTICSHUB_SECRET_KEY;
}

/** Decode the root secret to bytes, or return the reason it is unusable. */
function decodeSecret(): { key: Buffer } | { error: string; bytes?: number } {
  const raw = rawSecret();
  if (!raw) {
    return {
      error:
        "ANALYTICSHUB_SECRET_KEY is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` " +
        "and add it to website/.env.local (then redeploy).",
    };
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    return {
      error:
        `ANALYTICSHUB_SECRET_KEY must decode to 32 bytes (got ${key.length}). ` +
        "It looks truncated or not base64 — regenerate with `openssl rand -base64 32`.",
      bytes: key.length,
    };
  }
  return { key };
}

/** Health check for `GET status` — reports the exact secret problem. */
export function secretKeyStatus(): HealthCheck {
  const decoded = decodeSecret();
  if ("error" in decoded) return { ok: false, message: decoded.error };
  return { ok: true };
}

/** True when a usable encryption key is configured (feature gate). */
export function cryptoReady(): boolean {
  return "key" in decodeSecret();
}

let cachedKey: Buffer | null = null;

/** Derive the AES-256 data key via HKDF, or throw a clear config error. */
function dataKey(): Buffer {
  if (cachedKey) return cachedKey;
  const decoded = decodeSecret();
  if ("error" in decoded) throw new Error(decoded.error);
  const derived = hkdfSync("sha256", decoded.key, HKDF_SALT, DATA_KEY_INFO, 32);
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

/** Encrypt a UTF-8 string → base64 `iv|tag|ciphertext`. */
export function encrypt(plaintext: string): string {
  const key = dataKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a value produced by `encrypt`; throws if the key or data is bad. */
export function decrypt(packed: string): string {
  const key = dataKey();
  const buf = Buffer.from(packed, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted value is malformed (too short).");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Encrypt a JSON-serializable object. */
export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

/** Decrypt + parse a value produced by `encryptJson`. */
export function decryptJson<T>(packed: string): T {
  return JSON.parse(decrypt(packed)) as T;
}
