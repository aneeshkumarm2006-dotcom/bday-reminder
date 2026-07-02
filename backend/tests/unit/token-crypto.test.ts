import { describe, expect, it } from 'vitest';

import { decryptToken, encryptToken, tokenCryptoReady } from '../../src/lib/token-crypto';

/**
 * Stage 14: the Gmail refresh token is stored encrypted at rest. These cover the
 * round-trip, that ciphertext is non-deterministic (fresh IV per call), and that
 * GCM authentication rejects a tampered value rather than returning garbage.
 * `GMAIL_TOKEN_ENC_KEY` is injected via vitest.config.ts.
 */
describe('token-crypto', () => {
  it('reports ready when a valid 32-byte key is configured', () => {
    expect(tokenCryptoReady()).toBe(true);
  });

  it('round-trips a secret through encrypt → decrypt', () => {
    const secret = '1//0abcDEF_refresh-token.value~with-symbols';
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  it('round-trips non-ASCII content', () => {
    const secret = 'tökén-🎉-送信';
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const secret = 'same-input';
    expect(encryptToken(secret)).not.toBe(encryptToken(secret));
  });

  it('rejects a tampered ciphertext (GCM auth tag)', () => {
    const packed = Buffer.from(encryptToken('sensitive'), 'base64');
    packed[packed.length - 1] ^= 0xff; // flip a bit in the ciphertext
    expect(() => decryptToken(packed.toString('base64'))).toThrow();
  });

  it('rejects a malformed (too short) value', () => {
    expect(() => decryptToken('AAAA')).toThrow();
  });
});
