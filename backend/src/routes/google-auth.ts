import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../lib/async-handler';
import { startSession } from '../lib/auth-tokens';
import { loadEnv } from '../lib/env';
import {
  buildLoginConsentUrl,
  exchangeCodeForIdentity,
  googleLoginConfigured,
  signGoogleHandoff,
  verifyGoogleHandoff,
  verifyLoginState,
  type OAuthPlatform,
} from '../lib/google-oauth';
import { unauthorized } from '../lib/http-error';
import { logger } from '../lib/logger';
import { DEFAULT_TIMEZONE } from '../lib/region';
import { serializeUser } from '../lib/serialize';
import { validateBody } from '../middleware/validate';
import { User } from '../models/User';

/**
 * "Sign in with Google" (identity login). Mounted under `/auth`, so:
 *   - GET  /auth/google/start    → 302 to Google's consent screen (identity only)
 *   - GET  /auth/google/callback → Google's redirect; find-or-create the user,
 *                                  then 302 back to the website with a handoff
 *   - POST /auth/google/session  → exchange the handoff for the real JWT pair
 *
 * Deliberately separate from the Gmail send-as flow (Stage 14): logging in never
 * asks for `gmail.send`. That heavier permission is requested later, only when
 * the user turns on auto-send - Google's incremental-authorization pattern.
 */

export const googleAuthRouter = Router();

/** First configured website origin (the value may be a comma-separated list). */
function websiteOrigin(): string {
  return loadEnv().WEBSITE_ORIGIN.split(',')[0].trim().replace(/\/+$/, '');
}

/**
 * GET /auth/google/start - top-level navigation target for the "Continue with
 * Google" button. Redirects straight to Google's consent screen; if the feature
 * isn't provisioned, bounces back to the website login with an error flag so the
 * page can show a friendly message rather than a raw 503.
 */
googleAuthRouter.get(
  '/google/start',
  asyncHandler(async (req, res) => {
    const platform: OAuthPlatform = req.query.platform === 'web' ? 'web' : 'app';
    if (!googleLoginConfigured()) {
      if (platform === 'web') {
        res.redirect(`${websiteOrigin()}/login?google=unavailable`);
        return;
      }
      res.redirect('circlethedate://google-login?status=unavailable');
      return;
    }
    res.redirect(buildLoginConsentUrl(platform));
  }),
);

/**
 * GET /auth/google/callback - Google's redirect. Exchanges the code for the
 * verified identity, finds-or-creates (and auto-links, since Google verified the
 * email) the user, and 302s back to the website with a short-lived handoff. Any
 * failure redirects with an error status rather than surfacing a raw error.
 */
googleAuthRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    // Resolve the return platform from state first so even failures land back in
    // the right place; default to the app deep link if state is unreadable.
    let platform: OAuthPlatform = 'app';
    if (state) {
      try {
        platform = verifyLoginState(state).platform;
      } catch {
        /* unreadable/tampered state - fall through to the error redirect */
      }
    }

    const fail = () => {
      if (platform === 'web') {
        res.redirect(`${websiteOrigin()}/login?google=error`);
      } else {
        res.redirect('circlethedate://google-login?status=error');
      }
    };

    if (error || !code || !state) {
      logger.warn(`google login callback failed: ${error ?? (!code ? 'no code' : 'no state')}`);
      fail();
      return;
    }
    // Re-verify state strictly (the block above swallowed errors just to pick a
    // return platform); a bad state must not reach the token exchange.
    try {
      verifyLoginState(state);
    } catch {
      logger.warn('google login callback failed: bad state');
      fail();
      return;
    }

    try {
      const identity = await exchangeCodeForIdentity(code);

      // Find-or-create + auto-link. Match by googleId first (the durable key),
      // then by email so an existing password account is linked, not duplicated.
      let user = await User.findOne({ googleId: identity.googleId });
      let isNew = false;
      if (!user) {
        user = await User.findOne({ email: identity.email });
        if (user) {
          // Existing password account with the same (Google-verified) email:
          // attach the Google identity so future one-tap logins work.
          if (!user.googleId) {
            user.googleId = identity.googleId;
            await user.save();
          }
        } else {
          user = await User.create({
            name: identity.name,
            email: identity.email,
            googleId: identity.googleId,
            timezone: DEFAULT_TIMEZONE,
          });
          isNew = true;
        }
      }

      logger.info(`google login for user ${user._id.toString()} (${identity.email})${isNew ? ' [new]' : ''}`);
      const handoff = signGoogleHandoff(user._id.toString(), isNew);
      if (platform === 'web') {
        res.redirect(`${websiteOrigin()}/auth/google?handoff=${encodeURIComponent(handoff)}`);
      } else {
        res.redirect(`circlethedate://google-login?status=ok&handoff=${encodeURIComponent(handoff)}`);
      }
    } catch (err) {
      logger.error('google login token exchange failed', err instanceof Error ? err.message : err);
      fail();
    }
  }),
);

const sessionSchema = z.object({ handoff: z.string().min(1, 'Missing handoff token.') });

/**
 * POST /auth/google/session - exchange the one-time handoff for a real JWT pair.
 * The website's callback page calls this immediately after the redirect lands.
 */
googleAuthRouter.post(
  '/google/session',
  validateBody(sessionSchema),
  asyncHandler(async (req, res) => {
    const { handoff } = req.body as z.infer<typeof sessionSchema>;
    let userId: string;
    let isNew: boolean;
    try {
      ({ userId, isNew } = verifyGoogleHandoff(handoff));
    } catch {
      throw unauthorized('This sign-in link has expired. Please try signing in again.');
    }
    const user = await User.findById(userId);
    if (!user) throw unauthorized('This sign-in link has expired. Please try signing in again.');

    const tokens = await startSession(user._id.toString());
    res.json({ user: serializeUser(user), isNew, ...tokens });
  }),
);
