import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { unauthorized } from './http-error';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt';
import { RefreshToken } from '../models/RefreshToken';

/**
 * Token issuance + refresh-token rotation/revocation (TODO Stage 1).
 *
 * Each refresh token carries a unique `jti` that we persist. Refreshing rotates
 * it (old row deleted, new one issued), so a refresh token is single-use — a
 * stolen/replayed old token is rejected. Logout deletes the row.
 */

export type TokenPair = { accessToken: string; refreshToken: string };

const SESSION_EXPIRED = 'Your session has expired. Please log in again.';

async function issueTokens(userId: string): Promise<TokenPair> {
  const accessToken = signAccessToken(userId);
  const jti = randomUUID();
  const refreshToken = signRefreshToken(userId, jti);

  // Use the JWT's own `exp` so the stored record's TTL matches the token.
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({ user: userId, jti, expiresAt });
  return { accessToken, refreshToken };
}

/** Issue a fresh access + refresh pair (signup / login). */
export function startSession(userId: string): Promise<TokenPair> {
  return issueTokens(userId);
}

/** Validate + rotate a refresh token. Rejects revoked/rotated/expired tokens. */
export async function rotateRefreshToken(presented: string): Promise<TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(presented);
  } catch {
    throw unauthorized(SESSION_EXPIRED);
  }

  const existing = await RefreshToken.findOne({ jti: payload.jti, user: payload.sub });
  if (!existing) {
    throw unauthorized(SESSION_EXPIRED);
  }
  await existing.deleteOne();
  return issueTokens(payload.sub);
}

/** Revoke a refresh token (logout). Idempotent — invalid tokens are ignored. */
export async function revokeRefreshToken(presented: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(presented);
    await RefreshToken.deleteOne({ jti: payload.jti });
  } catch {
    // Already invalid/expired — nothing to revoke.
  }
}
