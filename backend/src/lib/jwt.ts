import jwt, { type SignOptions } from 'jsonwebtoken';

import { loadEnv } from './env';

/**
 * JWT helpers (custom auth — TODO Stage 1). Two token types signed with
 * separate secrets: a short-lived access token and a long-lived refresh token.
 * The refresh token carries a `jti` so it can be tracked/revoked server-side
 * (see the RefreshToken model + auth route rotation).
 */

export type AccessPayload = { sub: string; type: 'access' };
export type RefreshPayload = { sub: string; jti: string; type: 'refresh' };

export function signAccessToken(userId: string): string {
  const env = loadEnv();
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign({ sub: userId, type: 'access' }, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(userId: string, jti: string): string {
  const env = loadEnv();
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign({ sub: userId, jti, type: 'refresh' }, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): AccessPayload {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  if (decoded.type !== 'access') throw new Error('Not an access token');
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
  if (decoded.type !== 'refresh') throw new Error('Not a refresh token');
  return decoded;
}
