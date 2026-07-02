import jwt from 'jsonwebtoken';

import { loadEnv } from './env';
import { tokenCryptoReady } from './token-crypto';

/**
 * Google OAuth 2.0 helpers for the Gmail send-as integration (Stage 14). Raw
 * `fetch` against Google's token endpoints - no SDK, matching the Resend/Expo
 * channels. The only scope requested is `gmail.send` (send-only; it cannot read
 * the user's mail) plus `openid email` so the token response's id_token carries
 * the connected address.
 *
 * The whole flow is backend-driven: `/connect` returns a consent URL whose
 * `state` is a short-lived signed JWT binding the request to a user (and the
 * platform to return to), and `/callback` exchanges the code and stores the
 * encrypted refresh token. Absent client credentials → the feature is "not
 * configured" and every entry point degrades gracefully.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export const GMAIL_SCOPE = 'openid email https://www.googleapis.com/auth/gmail.send';

/**
 * Sign-in scope (identity only). Deliberately does NOT include `gmail.send`:
 * logging in must never trigger the scary "this app wants to send email as you"
 * consent. That heavier scope is requested separately, later, when the user
 * actually turns on auto-send (the Stage 14 GMAIL_SCOPE flow) - Google's
 * incremental-authorization pattern, so the two grants stay decoupled.
 */
export const LOGIN_SCOPE = 'openid email profile';

export type OAuthPlatform = 'app' | 'web';

/** State payload signed into the consent URL and read back on callback. */
interface StatePayload {
  sub: string;
  platform: OAuthPlatform;
  type: 'gmail_oauth';
}

/** True only when client id, secret, and the token-encryption key are all set. */
export function gmailOAuthConfigured(): boolean {
  const env = loadEnv();
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET && tokenCryptoReady();
}

/** The redirect URI Google calls back; explicit env wins, else derived from the API URL. */
export function redirectUri(): string {
  const env = loadEnv();
  if (env.GOOGLE_OAUTH_REDIRECT_URL) return env.GOOGLE_OAUTH_REDIRECT_URL;
  return `${env.API_PUBLIC_URL.replace(/\/+$/, '')}/integrations/gmail/callback`;
}

/** Sign the CSRF/identity state token (10-minute lifetime is plenty for a consent). */
function signState(userId: string, platform: OAuthPlatform): string {
  const env = loadEnv();
  const payload: StatePayload = { sub: userId, platform, type: 'gmail_oauth' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '10m' });
}

/** Verify + decode a state token; throws on tamper/expiry/wrong type. */
export function verifyState(state: string): { userId: string; platform: OAuthPlatform } {
  const env = loadEnv();
  const decoded = jwt.verify(state, env.JWT_ACCESS_SECRET) as StatePayload;
  if (decoded.type !== 'gmail_oauth') throw new Error('Not a gmail_oauth state token');
  const platform: OAuthPlatform = decoded.platform === 'web' ? 'web' : 'app';
  return { userId: decoded.sub, platform };
}

/** Build the Google consent URL for one user + return platform. */
export function buildConsentUrl(opts: {
  userId: string;
  platform: OAuthPlatform;
  loginHint?: string;
}): string {
  const env = loadEnv();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPE,
    // offline + consent guarantees a refresh_token even on re-connect.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: signState(opts.userId, opts.platform),
  });
  if (opts.loginHint) params.set('login_hint', opts.loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

/** Decode a JWT's payload without verifying (id_token already came from Google over TLS). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface ExchangedTokens {
  refreshToken: string;
  email: string;
  scope?: string;
}

/** Exchange an authorization code for tokens; returns the refresh token + connected email. */
export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const env = loadEnv();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = (await res.json().catch(() => null)) as {
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!res.ok || !data) {
    throw new Error(data?.error_description || data?.error || `token exchange failed (${res.status})`);
  }
  if (!data.refresh_token) {
    // No refresh token means Google reused a prior grant; prompt=consent should
    // prevent this, but guard so we never store a half-connected integration.
    throw new Error('Google did not return a refresh token; try disconnecting and reconnecting.');
  }
  const email = String(decodeJwtPayload(data.id_token ?? '').email ?? '').toLowerCase();
  if (!email) throw new Error('Could not read the Google account email from the token response.');
  return { refreshToken: data.refresh_token, email, scope: data.scope };
}

/** Exchange a stored refresh token for a fresh short-lived access token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const env = loadEnv();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!res.ok || !data?.access_token) {
    // `invalid_grant` = the user revoked access or the token expired; the caller
    // treats this as "disconnected" and clears the stored integration.
    const message = data?.error || `token refresh failed (${res.status})`;
    const err = new Error(data?.error_description || message);
    (err as { code?: string }).code = data?.error ?? String(res.status);
    throw err;
  }
  return data.access_token;
}

/** Best-effort token revocation on disconnect; failures are swallowed by the caller. */
export async function revokeToken(refreshToken: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }).toString(),
  });
}

// ── "Sign in with Google" (identity login) ───────────────────────────────────
// Reuses the SAME Google project / client id + secret as the Gmail send-as
// integration, but a distinct redirect URI and the identity-only LOGIN_SCOPE.
// Because there's no stored refresh token, token-crypto is NOT required here -
// only the client id + secret. Both redirect URIs must be registered in the
// Google Cloud console's OAuth client.

/** True when the client id + secret are set (login needs no token encryption). */
export function googleLoginConfigured(): boolean {
  const env = loadEnv();
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

/** The redirect URI Google calls back for login; explicit env wins, else derived. */
export function loginRedirectUri(): string {
  const env = loadEnv();
  if (env.GOOGLE_LOGIN_REDIRECT_URL) return env.GOOGLE_LOGIN_REDIRECT_URL;
  return `${env.API_PUBLIC_URL.replace(/\/+$/, '')}/auth/google/callback`;
}

/** State payload for the login flow - no user yet, just the return platform. */
interface LoginStatePayload {
  platform: OAuthPlatform;
  type: 'google_login';
}

function signLoginState(platform: OAuthPlatform): string {
  const env = loadEnv();
  const payload: LoginStatePayload = { platform, type: 'google_login' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '10m' });
}

/** Verify + decode a login state token; throws on tamper/expiry/wrong type. */
export function verifyLoginState(state: string): { platform: OAuthPlatform } {
  const env = loadEnv();
  const decoded = jwt.verify(state, env.JWT_ACCESS_SECRET) as LoginStatePayload;
  if (decoded.type !== 'google_login') throw new Error('Not a google_login state token');
  return { platform: decoded.platform === 'web' ? 'web' : 'app' };
}

/** Build the Google consent URL for signing in (identity scope only). */
export function buildLoginConsentUrl(platform: OAuthPlatform): string {
  const env = loadEnv();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: loginRedirectUri(),
    response_type: 'code',
    scope: LOGIN_SCOPE,
    // Login needs no offline/refresh token, and no forced `prompt=consent` -
    // returning users skip the consent screen entirely for a one-tap sign-in.
    include_granted_scopes: 'true',
    state: signLoginState(platform),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleIdentity {
  /** Google's stable account id (`sub`) - the durable link key. */
  googleId: string;
  email: string;
  name: string;
}

/** Exchange a login authorization code for the user's verified identity. */
export async function exchangeCodeForIdentity(code: string): Promise<GoogleIdentity> {
  const env = loadEnv();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: loginRedirectUri(),
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = (await res.json().catch(() => null)) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!res.ok || !data) {
    throw new Error(data?.error_description || data?.error || `token exchange failed (${res.status})`);
  }
  const claims = decodeJwtPayload(data.id_token ?? '');
  const googleId = String(claims.sub ?? '');
  const email = String(claims.email ?? '').toLowerCase();
  // Fall back to the email's local part if Google returns no display name.
  const name = String(claims.name ?? '').trim() || email.split('@')[0] || 'Friend';
  if (!googleId || !email) {
    throw new Error('Could not read the Google account identity from the token response.');
  }
  return { googleId, email, name };
}

interface HandoffPayload {
  sub: string;
  isNew: boolean;
  type: 'google_handoff';
}

/**
 * Short-lived one-time-ish "handoff" token. The backend callback can't write to
 * the browser's localStorage, so instead of putting the real (long-lived)
 * refresh token in the redirect URL, it signs this tiny 2-minute token; the
 * website POSTs it straight back to `/auth/google/session` and receives the real
 * JWT pair. Kept out of the URL any longer than one navigation.
 */
export function signGoogleHandoff(userId: string, isNew: boolean): string {
  const env = loadEnv();
  const payload: HandoffPayload = { sub: userId, isNew, type: 'google_handoff' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '2m' });
}

/** Verify a handoff token; throws on tamper/expiry/wrong type. */
export function verifyGoogleHandoff(token: string): { userId: string; isNew: boolean } {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as HandoffPayload;
  if (decoded.type !== 'google_handoff') throw new Error('Not a google_handoff token');
  return { userId: decoded.sub, isNew: !!decoded.isNew };
}
