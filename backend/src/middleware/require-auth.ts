import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { unauthorized } from '../lib/http-error';
import { verifyAccessToken } from '../lib/jwt';
import { User } from '../models/User';

/**
 * Verifies the `Authorization: Bearer <accessToken>` header, loads the user,
 * and attaches it to the request. Rejects with 401 on a missing/expired/invalid
 * token or a user that no longer exists.
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized();
  }
  const token = header.slice('Bearer '.length).trim();

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    throw unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw unauthorized('Your session is no longer valid. Please log in again.');
  }

  req.userId = user._id.toString();
  req.user = user;
  next();
});
