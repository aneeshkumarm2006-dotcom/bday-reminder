import { generateKeyPairSync, type KeyObject } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetAppleKeyCache,
  appleLoginConfigured,
  verifyAppleIdentityToken,
} from '../../src/lib/apple-oauth';

/**
 * Sign in with Apple token verification (App Store Guideline 4.8). Apple's real
 * keys can't be used offline, so we stand up our own RSA pair, serve it as a
 * JWKS through a stubbed `fetch`, and mint tokens with it - which exercises the
 * genuine RS256 path rather than mocking the verification away.
 */

const KID = 'test-key-1';
const BUNDLE_ID = 'com.circlethedate.app';

let privateKey: KeyObject;
let jwks: { keys: unknown[] };

function mintToken(claims: Record<string, unknown> = {}, kid = KID): string {
  return jwt.sign(
    {
      iss: 'https://appleid.apple.com',
      aud: BUNDLE_ID,
      sub: '001234.abcdef.5678',
      email: 'friend@privaterelay.appleid.com',
      email_verified: 'true',
      is_private_email: 'true',
      ...claims,
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: '10m', keyid: kid },
  );
}

beforeEach(() => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = pair.privateKey;
  jwks = { keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] };

  __resetAppleKeyCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => jwks }) as unknown as Response),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('appleLoginConfigured', () => {
  it('is true when the audience is provisioned (vitest.config.ts injects it)', () => {
    expect(appleLoginConfigured()).toBe(true);
  });

  it('is false when APPLE_CLIENT_ID is unset, so the button stays hidden', async () => {
    // loadEnv() caches on first read, so a fresh module registry is the only way
    // to observe a different environment.
    vi.resetModules();
    const previous = process.env.APPLE_CLIENT_ID;
    delete process.env.APPLE_CLIENT_ID;
    try {
      const mod = await import('../../src/lib/apple-oauth');
      expect(mod.appleLoginConfigured()).toBe(false);
    } finally {
      process.env.APPLE_CLIENT_ID = previous;
      vi.resetModules();
    }
  });
});

describe('verifyAppleIdentityToken', () => {
  it('accepts a genuine token and surfaces the stable subject', async () => {
    const identity = await verifyAppleIdentityToken(mintToken());
    expect(identity.appleUserId).toBe('001234.abcdef.5678');
    expect(identity.email).toBe('friend@privaterelay.appleid.com');
  });

  it("reads Apple's string booleans as real booleans", async () => {
    const identity = await verifyAppleIdentityToken(mintToken());
    expect(identity.emailVerified).toBe(true);
    expect(identity.isPrivateRelay).toBe(true);
  });

  it('flags a normal address as not private relay', async () => {
    const identity = await verifyAppleIdentityToken(
      mintToken({ email: 'Real@Example.com', is_private_email: 'false' }),
    );
    expect(identity.email).toBe('real@example.com');
    expect(identity.isPrivateRelay).toBe(false);
  });

  it('rejects a token signed by someone other than Apple', async () => {
    const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign(
      { iss: 'https://appleid.apple.com', aud: BUNDLE_ID, sub: 'attacker' },
      attacker.privateKey,
      { algorithm: 'RS256', expiresIn: '10m', keyid: KID },
    );
    await expect(verifyAppleIdentityToken(forged)).rejects.toThrow();
  });

  it('rejects a token minted for a different app (wrong audience)', async () => {
    await expect(verifyAppleIdentityToken(mintToken({ aud: 'com.someone.else' }))).rejects.toThrow();
  });

  it('rejects a token from the wrong issuer', async () => {
    await expect(
      verifyAppleIdentityToken(mintToken({ iss: 'https://evil.example.com' })),
    ).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { iss: 'https://appleid.apple.com', aud: BUNDLE_ID, sub: 'x' },
      privateKey,
      { algorithm: 'RS256', expiresIn: -60, keyid: KID },
    );
    await expect(verifyAppleIdentityToken(expired)).rejects.toThrow();
  });

  it('rejects an unsigned (alg: none) token', async () => {
    const none = jwt.sign({ iss: 'https://appleid.apple.com', aud: BUNDLE_ID, sub: 'x' }, '', {
      algorithm: 'none',
    });
    await expect(verifyAppleIdentityToken(none)).rejects.toThrow();
  });

  it('refetches the JWKS when it meets an unknown key id, so rotation self-heals', async () => {
    // Prime the cache with a key set that lacks the kid the next token uses.
    await verifyAppleIdentityToken(mintToken());
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

    const rotated = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = rotated.privateKey;
    jwks = {
      keys: [{ ...rotated.publicKey.export({ format: 'jwk' }), kid: 'rotated', alg: 'RS256', use: 'sig' }],
    };

    const identity = await verifyAppleIdentityToken(mintToken({}, 'rotated'));
    expect(identity.appleUserId).toBe('001234.abcdef.5678');
    expect(
      (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length,
    ).toBeGreaterThan(calls);
  });

  it('refuses to verify anything when the feature is unconfigured', async () => {
    const token = mintToken();
    vi.resetModules();
    const previous = process.env.APPLE_CLIENT_ID;
    delete process.env.APPLE_CLIENT_ID;
    try {
      const mod = await import('../../src/lib/apple-oauth');
      await expect(mod.verifyAppleIdentityToken(token)).rejects.toThrow(/not configured/i);
    } finally {
      process.env.APPLE_CLIENT_ID = previous;
      vi.resetModules();
    }
  });
});
