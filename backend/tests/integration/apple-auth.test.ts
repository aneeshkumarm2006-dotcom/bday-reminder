import { generateKeyPairSync, type KeyObject } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeApi, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';
import { __resetAppleKeyCache } from '../../src/lib/apple-oauth';
import { User } from '../../src/models/User';

/**
 * POST /auth/apple/session - "Sign in with Apple" (App Store Guideline 4.8).
 * Apple's real signing keys aren't reachable offline, so we serve our own JWKS
 * through a stubbed `fetch` and mint tokens with the matching private key; the
 * route runs its genuine RS256 verification against them.
 */

const KID = 'itest-key';
const BUNDLE_ID = 'com.circlethedate.app';
const APPLE_SUB = '001999.feedface.0001';

let privateKey: KeyObject;
let jwks: { keys: unknown[] };

function mintToken(claims: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      iss: 'https://appleid.apple.com',
      aud: BUNDLE_ID,
      sub: APPLE_SUB,
      email: 'apple.user@example.com',
      email_verified: 'true',
      ...claims,
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: '10m', keyid: KID },
  );
}

describe('sign in with apple (Guideline 4.8)', () => {
  useTestDb();
  let api: Api;

  beforeEach(() => {
    ({ api } = makeApi());
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = pair.privateKey;
    jwks = {
      keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }],
    };
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

  it('creates an account on first sign-in and returns a usable token pair', async () => {
    const res = await api.post('/auth/apple/session').send({
      identityToken: mintToken(),
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    });

    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(true);
    expect(res.body.user.email).toBe('apple.user@example.com');
    expect(res.body.user.name).toBe('Ada Lovelace');
    expect(res.body.user.passwordHash).toBeUndefined();

    // The returned access token must actually authenticate.
    const me = await api.get('/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('apple.user@example.com');
  });

  it('returns the same account on the second sign-in, matching on the Apple subject', async () => {
    const first = await api
      .post('/auth/apple/session')
      .send({ identityToken: mintToken(), fullName: { givenName: 'Ada' } });

    // Apple stops sending the name after the first authorization, and may omit
    // the email too - the stable `sub` has to carry the match on its own.
    const second = await api
      .post('/auth/apple/session')
      .send({ identityToken: mintToken({ email: undefined }) });

    expect(second.status).toBe(200);
    expect(second.body.isNew).toBe(false);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(await User.countDocuments({})).toBe(1);
  });

  it('links Apple onto an existing password account instead of duplicating it', async () => {
    const signup = await api.post('/auth/signup').send({
      name: 'Existing Person',
      email: 'apple.user@example.com',
      password: 'supersecret',
      birthday: { month: 5, day: 4 },
    });
    expect(signup.status).toBe(201);

    const res = await api.post('/auth/apple/session').send({ identityToken: mintToken() });

    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(false);
    expect(res.body.user.id).toBe(signup.body.user.id);
    // Still one account, now carrying the Apple identity.
    expect(await User.countDocuments({})).toBe(1);
    const linked = await User.findOne({ email: 'apple.user@example.com' });
    expect(linked?.appleId).toBe(APPLE_SUB);
    // The original password login must keep working.
    const login = await api
      .post('/auth/login')
      .send({ email: 'apple.user@example.com', password: 'supersecret' });
    expect(login.status).toBe(200);
  });

  it('keeps a private-relay address as the account email', async () => {
    const res = await api.post('/auth/apple/session').send({
      identityToken: mintToken({
        email: 'zz9x@privaterelay.appleid.com',
        is_private_email: 'true',
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('zz9x@privaterelay.appleid.com');
  });

  it('falls back to the email local part when Apple sends no name', async () => {
    const res = await api.post('/auth/apple/session').send({ identityToken: mintToken() });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('apple.user');
  });

  it('rejects a forged token with 401 and creates nothing', async () => {
    const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign(
      { iss: 'https://appleid.apple.com', aud: BUNDLE_ID, sub: 'attacker' },
      attacker.privateKey,
      { algorithm: 'RS256', expiresIn: '10m', keyid: KID },
    );

    const res = await api.post('/auth/apple/session').send({ identityToken: forged });
    expect(res.status).toBe(401);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('rejects a token minted for another app', async () => {
    const res = await api
      .post('/auth/apple/session')
      .send({ identityToken: mintToken({ aud: 'com.someone.else' }) });
    expect(res.status).toBe(401);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('rejects a missing identity token with 400', async () => {
    const res = await api.post('/auth/apple/session').send({});
    expect(res.status).toBe(400);
  });

  it('explains itself when Apple shares no email and there is no account to link', async () => {
    const res = await api
      .post('/auth/apple/session')
      .send({ identityToken: mintToken({ email: undefined }) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('advertises availability through GET /config so the client can hide the button', async () => {
    const res = await api.get('/config');
    expect(res.status).toBe(200);
    expect(res.body.appleAuthAvailable).toBe(true);
  });
});
