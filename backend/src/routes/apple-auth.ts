import { Router } from 'express';
import { z } from 'zod';

import { appleLoginConfigured, verifyAppleIdentityToken } from '../lib/apple-oauth';
import { asyncHandler } from '../lib/async-handler';
import { startSession } from '../lib/auth-tokens';
import { HttpError, badRequest, unauthorized } from '../lib/http-error';
import { logger } from '../lib/logger';
import { DEFAULT_TIMEZONE } from '../lib/region';
import { serializeUser } from '../lib/serialize';
import { validateBody } from '../middleware/validate';
import { User } from '../models/User';

/**
 * "Sign in with Apple" (identity login). Mounted under `/auth`, so:
 *   - POST /auth/apple/session → verify the identity token, find-or-create the
 *                                user, and return the normal JWT pair.
 *
 * One endpoint, not three: unlike Google there is no redirect dance. The iOS app
 * runs Apple's native sheet via `expo-apple-authentication` and posts the
 * resulting identity token straight here, so there is no consent URL, no code
 * exchange, and no handoff token to mint.
 *
 * Two Apple quirks drive the shape of this handler:
 *   - `fullName` is returned by Apple ONLY on the very first authorization, so
 *     the client forwards it and we use it just for account creation.
 *   - The user may hide their real address behind an @privaterelay.appleid.com
 *     relay. That is a normal, permanent address for our purposes - reminders
 *     sent to it are forwarded by Apple, provided the sending domain is
 *     registered in the Apple developer console.
 */

export const appleAuthRouter = Router();

const sessionSchema = z.object({
  identityToken: z.string().min(1, 'Missing Apple identity token.'),
  /** Apple returns the name only on first authorization; the client forwards it. */
  fullName: z
    .object({
      givenName: z.string().trim().max(100).nullish(),
      familyName: z.string().trim().max(100).nullish(),
    })
    .nullish(),
  /** First-authorization email, forwarded as a fallback if the token omits it. */
  email: z.string().trim().toLowerCase().email().nullish(),
});

type SessionInput = z.infer<typeof sessionSchema>;

/** Build a display name from Apple's one-shot name, else the email local part. */
function resolveName(fullName: SessionInput['fullName'], email: string): string {
  const parts = [fullName?.givenName, fullName?.familyName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  const joined = parts.join(' ').trim();
  if (joined) return joined;
  return email.split('@')[0] || 'Friend';
}

appleAuthRouter.post(
  '/apple/session',
  validateBody(sessionSchema),
  asyncHandler(async (req, res) => {
    if (!appleLoginConfigured()) {
      throw new HttpError(503, "Sign in with Apple isn't available right now.", {
        code: 'apple_not_configured',
      });
    }

    const { identityToken, fullName, email: bodyEmail } = req.body as SessionInput;

    let identity;
    try {
      identity = await verifyAppleIdentityToken(identityToken);
    } catch (err) {
      logger.warn(
        `apple identity token rejected: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw unauthorized("Couldn't verify that Apple sign-in. Please try again.");
    }

    // Match on the Apple `sub` first - it is the only claim guaranteed on every
    // sign-in. Fall back to email so an existing password/Google account is
    // linked rather than duplicated.
    let user = await User.findOne({ appleId: identity.appleUserId });
    let isNew = false;

    if (!user) {
      // Apple omits `email` from the token once the user has authorized before,
      // so accept the client's first-authorization value as a fallback.
      const email = identity.email ?? bodyEmail ?? undefined;

      if (email) user = await User.findOne({ email });

      if (user) {
        // Existing account with the same Apple-verified address: attach the
        // Apple identity so future sign-ins match on `sub` directly.
        if (!user.appleId) {
          user.appleId = identity.appleUserId;
          await user.save();
        }
      } else {
        if (!email) {
          // No stored account and Apple gave us nothing to key one on. Sending
          // them round the loop again won't help - Apple only re-reveals the
          // email after the app is removed from their Apple ID settings.
          throw badRequest(
            "Apple didn't share an email with us, so we can't create your account. " +
              'Sign up with your email address instead, then link Apple from Settings.',
          );
        }
        user = await User.create({
          name: resolveName(fullName, email),
          email,
          appleId: identity.appleUserId,
          timezone: DEFAULT_TIMEZONE,
        });
        isNew = true;
      }
    }

    logger.info(
      `apple login for user ${user._id.toString()}${identity.isPrivateRelay ? ' [private relay]' : ''}${isNew ? ' [new]' : ''}`,
    );

    const tokens = await startSession(user._id.toString());
    res.json({ user: serializeUser(user), isNew, ...tokens });
  }),
);
