import { createPublicKey, type JsonWebKey } from 'node:crypto';

import jwt, { type JwtHeader } from 'jsonwebtoken';

import { loadEnv } from './env';

/**
 * "Sign in with Apple" (identity login). Unlike the Google flow there is no
 * server-side code exchange: the iOS app talks to Apple directly through
 * `expo-apple-authentication` and hands us the resulting **identity token** - a
 * JWT signed by Apple. All this module does is verify that token is genuine and
 * pull the stable user id + email out of it.
 *
 * Required for the App Store: Apple's Guideline 4.8 says an app offering a
 * third-party social login (our "Continue with Google") must also offer a
 * privacy-preserving equivalent. Apple's own is that equivalent.
 *
 * Verification checks, in order:
 *   1. RS256 signature against Apple's published JWKS (cached, refetched on an
 *      unknown `kid` so key rotation heals itself).
 *   2. `iss` is exactly https://appleid.apple.com.
 *   3. `aud` is one of our configured client ids (the iOS bundle id; a web
 *      Services ID can be added later as a second comma-separated entry).
 *   4. `exp` / `nbf` (enforced by jsonwebtoken).
 *
 * Fully optional: with APPLE_CLIENT_ID unset the feature reports "not
 * configured", GET /config hides the button, and nothing else changes.
 */

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';

/** Apple rotates signing keys slowly; a day of caching is plenty and the
 *  unknown-`kid` refetch below covers a rotation that lands mid-cache. */
const KEYS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface AppleJwk {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
}

let keyCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;

/** Configured audiences - the iOS bundle id, plus any extra comma-separated ids. */
function clientIds(): string[] {
  const raw = loadEnv().APPLE_CLIENT_ID ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when Sign in with Apple is provisioned on this server. */
export function appleLoginConfigured(): boolean {
  return clientIds().length > 0;
}

async function fetchAppleKeys(): Promise<AppleJwk[]> {
  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) throw new Error(`Apple key fetch failed with ${res.status}`);
  const body = (await res.json()) as { keys?: AppleJwk[] };
  if (!body.keys?.length) throw new Error('Apple returned no signing keys.');
  keyCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/**
 * Resolve the signing key for a `kid`. Serves from cache when fresh, and on a
 * miss refetches once - so a key rotation recovers on the next request instead
 * of failing every sign-in until the TTL lapses.
 */
async function resolveKey(kid: string): Promise<AppleJwk> {
  const fresh = keyCache && Date.now() - keyCache.fetchedAt < KEYS_CACHE_TTL_MS;
  if (fresh) {
    const hit = keyCache!.keys.find((k) => k.kid === kid);
    if (hit) return hit;
  }
  const keys = await fetchAppleKeys();
  const key = keys.find((k) => k.kid === kid);
  if (!key) throw new Error(`Apple has no signing key for kid ${kid}.`);
  return key;
}

/** JWK → PEM. Node's WebCrypto-backed `createPublicKey` handles this natively,
 *  so no jwks-to-pem dependency is needed. */
function jwkToPem(jwk: AppleJwk): string {
  return createPublicKey({ key: jwk as unknown as JsonWebKey, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' })
    .toString();
}

export interface AppleIdentity {
  /** Apple's stable, per-developer-account user id (the `sub` claim). */
  appleUserId: string;
  /** Present when the user shared an email; may be an Apple private relay address. */
  email?: string;
  emailVerified: boolean;
  /** True for @privaterelay.appleid.com addresses (user chose "Hide My Email"). */
  isPrivateRelay: boolean;
}

interface AppleClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
}

/** Apple sends some booleans as the strings "true"/"false". */
function asBool(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}

/**
 * Verify an Apple identity token and return the identity it asserts. Throws on
 * any failure - the caller turns that into a 401 rather than leaking details.
 */
export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  const audiences = clientIds();
  if (audiences.length === 0) throw new Error('Sign in with Apple is not configured.');

  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || typeof decoded === 'string') throw new Error('Malformed Apple identity token.');
  const header = decoded.header as JwtHeader;
  if (header.alg !== 'RS256') throw new Error(`Unexpected Apple token algorithm ${header.alg}.`);
  if (!header.kid) throw new Error('Apple identity token has no key id.');

  const pem = jwkToPem(await resolveKey(header.kid));
  const claims = jwt.verify(identityToken, pem, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    // jsonwebtoken types the multi-audience form as a non-empty tuple; the
    // guard above already proved there is at least one entry.
    audience: audiences as [string, ...string[]],
  }) as AppleClaims;

  const appleUserId = String(claims.sub ?? '').trim();
  if (!appleUserId) throw new Error('Apple identity token carries no subject.');

  const email = String(claims.email ?? '')
    .trim()
    .toLowerCase();

  return {
    appleUserId,
    email: email || undefined,
    emailVerified: asBool(claims.email_verified),
    isPrivateRelay: asBool(claims.is_private_email) || email.endsWith('@privaterelay.appleid.com'),
  };
}

/** Test seam: drop the cached JWKS so a test can control what the next fetch returns. */
export function __resetAppleKeyCache(): void {
  keyCache = null;
}
