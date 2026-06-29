import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Shared-password session for the /seoteam dashboard. Next's cookie API has no
 * built-in signing, so we mint a compact HMAC-signed token ourselves (a tiny
 * JWT-alike) and verify it in proxy.ts + the route handlers. Server-only — never
 * import this from a client component.
 */

export const SESSION_COOKIE = "seoteam_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export interface SessionPayload {
  sub: "seoteam";
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters.");
  }
  return secret;
}

function b64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function createSessionToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: "seoteam",
    iat: now,
    exp: now + SESSION_MAX_AGE,
  };
  const data = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Returns the payload for a valid, unexpired token, else null. Never throws —
 * a missing/short SESSION_SECRET is treated as "not authenticated" so the proxy
 * degrades to the login screen rather than crashing every request.
 */
export function verifySessionToken(
  token: string | undefined | null,
): SessionPayload | null {
  if (!token) return null;
  try {
    const secret = getSecret();
    const dot = token.lastIndexOf(".");
    if (dot <= 0) return null;
    const data = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", secret).update(data).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.sub !== "seoteam") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Constant-time password comparison. Hashing both sides first equalizes length
 * (so timingSafeEqual never throws and the password length doesn't leak).
 */
export function verifyPassword(input: string): boolean {
  const expected = process.env.SEO_DASHBOARD_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(String(input)).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** True when both required secrets are configured. */
export function isDashboardConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return Boolean(process.env.SEO_DASHBOARD_PASSWORD && secret && secret.length >= 32);
}
