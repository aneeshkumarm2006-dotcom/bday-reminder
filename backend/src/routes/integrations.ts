import { Router } from 'express';

import {
  buildConsentUrl,
  buildImportConsentUrl,
  exchangeCode,
  gmailOAuthConfigured,
  googleImportConfigured,
  importRedirectUri,
  revokeToken,
  verifyImportState,
  verifyState,
  type OAuthPlatform,
} from '../lib/google-oauth';
import { asyncHandler } from '../lib/async-handler';
import { loadEnv } from '../lib/env';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { decryptToken, encryptToken } from '../lib/token-crypto';
import { requireAuth } from '../middleware/require-auth';
import { User } from '../models/User';

/**
 * Gmail send-as integration (Stage 14). Backend-driven OAuth so the same flow
 * works for the mobile app (opens the URL in an in-app browser, returns via the
 * `circlethedate://` deep link) and the website (full-page redirect back to
 * settings). Only `/connect` and `DELETE` require auth; `/callback` is called by
 * Google and authenticates via the signed `state` token, not a session.
 */

export const integrationsRouter = Router();

/** First configured website origin (the value may be a comma-separated list). */
function websiteOrigin(): string {
  return loadEnv().WEBSITE_ORIGIN.split(',')[0].trim().replace(/\/+$/, '');
}

/** Where to send the browser after the Gmail callback, per originating platform. */
function returnUrl(platform: OAuthPlatform, status: 'connected' | 'error'): string {
  if (platform === 'web') {
    return `${websiteOrigin()}/settings?gmail=${status}`;
  }
  return `circlethedate://gmail-connected?status=${status === 'connected' ? 'ok' : 'error'}`;
}

/** Where to send the browser after the Google-import callback (returns to the import screen). */
function importReturnUrl(platform: OAuthPlatform, status: 'connected' | 'error'): string {
  if (platform === 'web') {
    return `${websiteOrigin()}/import?google=${status}`;
  }
  return `circlethedate://google-import-connected?status=${status === 'connected' ? 'ok' : 'error'}`;
}

/**
 * GET /integrations/gmail/connect - returns the Google consent URL to open.
 * `?platform=app|web` decides where the callback returns the user.
 */
integrationsRouter.get(
  '/gmail/connect',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!gmailOAuthConfigured()) {
      throw new HttpError(503, 'Gmail auto-send isn’t configured on this server yet.', {
        code: 'gmail_not_configured',
      });
    }
    const platform: OAuthPlatform = req.query.platform === 'web' ? 'web' : 'app';
    const url = buildConsentUrl({
      userId: req.userId!,
      platform,
      loginHint: req.user!.email,
    });
    res.json({ url });
  }),
);

/**
 * GET /integrations/gmail/callback - Google's redirect. Exchanges the code,
 * stores the encrypted refresh token, and 302s back to the app/website. Errors
 * (user denied, bad state, exchange failure) redirect with an error status
 * rather than surfacing a raw JSON error in the browser.
 */
integrationsRouter.get(
  '/gmail/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    // Resolve the return platform from state first so even failures land back in
    // the right place; default to the app deep link if state is unreadable.
    let platform: OAuthPlatform = 'app';
    let userId: string | null = null;
    if (state) {
      try {
        const parsed = verifyState(state);
        platform = parsed.platform;
        userId = parsed.userId;
      } catch {
        userId = null;
      }
    }

    if (error || !code || !userId) {
      logger.warn(`gmail callback failed: ${error ?? (!code ? 'no code' : 'bad state')}`);
      res.redirect(returnUrl(platform, 'error'));
      return;
    }

    try {
      const { refreshToken, email, scope } = await exchangeCode(code);
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            gmailIntegration: {
              email,
              refreshTokenEnc: encryptToken(refreshToken),
              scope,
              connectedAt: new Date(),
            },
          },
        },
      );
      logger.info(`gmail connected for user ${userId} (${email})`);
      res.redirect(returnUrl(platform, 'connected'));
    } catch (err) {
      logger.error('gmail token exchange failed', err instanceof Error ? err.message : err);
      res.redirect(returnUrl(platform, 'error'));
    }
  }),
);

/**
 * DELETE /integrations/gmail - disconnect. Best-effort revokes the token with
 * Google, then removes the stored integration so auto-send stops immediately.
 */
integrationsRouter.delete(
  '/gmail',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Re-read with the token selected so we can revoke it with Google.
    const withToken = await User.findById(req.userId!).select('+gmailIntegration.refreshTokenEnc');
    const enc = withToken?.gmailIntegration?.refreshTokenEnc;
    if (enc) {
      try {
        await revokeToken(decryptToken(enc));
      } catch {
        // Revocation is best-effort; we still drop our copy below.
      }
    }
    await User.updateOne({ _id: req.userId! }, { $unset: { gmailIntegration: '' } });
    res.status(204).end();
  }),
);

// ── Google Calendar + Contacts import (Stage 16) ─────────────────────────────
// Same backend-driven OAuth shape as Gmail above, but requests the read-only
// calendar + contacts scopes JUST-IN-TIME (only when the user starts an import) and
// stores the refresh token in `User.googleImport` (kept separate from Gmail so
// disconnecting one never affects the other). The actual read happens later in
// POST /import/google/preview.

/**
 * GET /integrations/google-import/connect - returns the Google consent URL to open.
 * `?platform=app|web` decides where the callback returns the user (the import screen).
 */
integrationsRouter.get(
  '/google-import/connect',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!googleImportConfigured()) {
      throw new HttpError(503, 'Google import isn’t configured on this server yet.', {
        code: 'google_import_not_configured',
      });
    }
    const platform: OAuthPlatform = req.query.platform === 'web' ? 'web' : 'app';
    const url = buildImportConsentUrl({
      userId: req.userId!,
      platform,
      loginHint: req.user!.email,
    });
    res.json({ url });
  }),
);

/**
 * GET /integrations/google-import/callback - Google's redirect. Exchanges the code,
 * stores the encrypted refresh token on `User.googleImport`, and 302s back to the
 * import screen. Errors redirect with an error status rather than a raw JSON error.
 */
integrationsRouter.get(
  '/google-import/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    let platform: OAuthPlatform = 'app';
    let userId: string | null = null;
    if (state) {
      try {
        const parsed = verifyImportState(state);
        platform = parsed.platform;
        userId = parsed.userId;
      } catch {
        userId = null;
      }
    }

    if (error || !code || !userId) {
      logger.warn(`google-import callback failed: ${error ?? (!code ? 'no code' : 'bad state')}`);
      res.redirect(importReturnUrl(platform, 'error'));
      return;
    }

    try {
      // Import uses its OWN redirect URI, which must match the consent request.
      const { refreshToken, email, scope } = await exchangeCode(code, importRedirectUri());
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            googleImport: {
              email,
              refreshTokenEnc: encryptToken(refreshToken),
              scope,
              connectedAt: new Date(),
            },
          },
        },
      );
      logger.info(`google import connected for user ${userId} (${email})`);
      res.redirect(importReturnUrl(platform, 'connected'));
    } catch (err) {
      logger.error('google-import token exchange failed', err instanceof Error ? err.message : err);
      res.redirect(importReturnUrl(platform, 'error'));
    }
  }),
);

/**
 * DELETE /integrations/google-import - disconnect. Drops the stored token so re-sync
 * stops. Only network-revokes with Google when Gmail send-as ISN'T also connected:
 * `include_granted_scopes` links the two grants, so revoking here would also kill
 * Gmail auto-send - in that case we just drop our copy.
 */
integrationsRouter.delete(
  '/google-import',
  requireAuth,
  asyncHandler(async (req, res) => {
    const withToken = await User.findById(req.userId!).select('+googleImport.refreshTokenEnc');
    const enc = withToken?.googleImport?.refreshTokenEnc;
    if (enc && !withToken?.gmailIntegration?.email) {
      try {
        await revokeToken(decryptToken(enc));
      } catch {
        // Revocation is best-effort; we still drop our copy below.
      }
    }
    await User.updateOne({ _id: req.userId! }, { $unset: { googleImport: '' } });
    res.status(204).end();
  }),
);
