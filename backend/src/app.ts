import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { loadEnv } from './lib/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';
import { authRouter } from './routes/auth';
import { calendarFeedRouter, calendarRouter } from './routes/calendar';
import { configRouter } from './routes/config';
import { devRouter } from './routes/dev';
import { eventsRouter } from './routes/events';
import { importRouter } from './routes/import';
import { invitesRouter } from './routes/invites';
import { listsRouter } from './routes/lists';
import { meRouter } from './routes/me';
import { notesRouter } from './routes/notes';
import { peopleRouter } from './routes/people';
import { remindersRouter } from './routes/reminders';
import { upcomingRouter } from './routes/upcoming';
import { uploadsRouter } from './routes/uploads';

/**
 * Builds the Express app (TODO Stage 1). Separated from `server.ts` so it can be
 * created without a listener (e.g. the auth smoke test). Order: security headers
 * → CORS → body parsing → logging → routes → 404 → error handler.
 */
export function createApp(): Express {
  const env = loadEnv();
  const app = express();

  app.disable('x-powered-by');
  // Explicit helmet config for a JSON API (Stage 12): a locked-down CSP (this
  // host serves only JSON + the ICS feed, never HTML/scripts), no framing, and
  // HSTS in production. Resources stay cross-origin-fetchable so the public
  // calendar feed and the app/website can read the API.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      hsts: env.NODE_ENV === 'production' ? { maxAge: 15_552_000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Honor X-Forwarded-For so req.ip is the real client (rate-limit keying).
  // Decoupled from the rate-limit flag and matched to the deploy topology via
  // env: 1 hop in production by default, 0 (direct) elsewhere. Setting this wrong
  // breaks the limiter, so it's explicit, not coupled to an unrelated feature.
  app.set('trust proxy', env.TRUST_PROXY_HOPS ?? (env.NODE_ENV === 'production' ? 1 : 0));

  // CORS first - before the rate limiters - so even a 429 carries
  // Access-Control-Allow-Origin and the browser can read the friendly message
  // (the limiter short-circuits to the error handler, skipping later middleware).
  // Each origin may be a comma-separated list; non-browser clients (mobile, REST
  // tools) have no Origin and are unaffected.
  const allowedOrigins = [env.APP_ORIGIN, env.WEBSITE_ORIGIN].flatMap((s) =>
    s.split(',').map((v) => v.trim()).filter(Boolean),
  );
  app.use(cors({ origin: allowedOrigins, credentials: true }));

  // Rate limiting (Stage 12). On by default outside tests; a strict per-IP
  // limiter guards each credential endpoint (independent counters so a login
  // burst doesn't lock out signup) and a lenient global limiter caps flooding.
  const limitEnabled = env.RATE_LIMIT_ENABLED ?? env.NODE_ENV !== 'test';
  if (limitEnabled) {
    app.use(
      rateLimit({ windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS, max: env.GLOBAL_RATE_LIMIT_MAX }),
    );
    const authLimiter = () =>
      rateLimit({
        windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
        max: env.AUTH_RATE_LIMIT_MAX,
        message: 'Too many attempts. Please wait a few minutes and try again.',
      });
    app.use('/auth/login', authLimiter());
    app.use('/auth/signup', authLimiter());
  }

  // 8mb headroom for base64 photo uploads (FR-10); JSON bodies are otherwise tiny.
  app.use(express.json({ limit: '8mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev', { stream: { write: (message) => logger.info(message.trim()) } }));
  }

  app.get('/', (_req, res) => {
    res.json({ name: 'birthday-reminder-api', message: 'Birthday Reminder backend is running.' });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/auth', authRouter);
  app.use('/config', configRouter);
  // Calendar settings sit under /me/calendar; mount before the broader /me
  // router so the more specific prefix wins. The public feed is separate below.
  app.use('/me/calendar', calendarRouter);
  app.use('/me', meRouter);
  app.use('/people/:personId/notes', notesRouter);
  app.use('/people', peopleRouter);
  app.use('/events', eventsRouter);
  app.use('/lists', listsRouter);
  app.use('/invites', invitesRouter);
  app.use('/import', importRouter);
  app.use('/reminders', remindersRouter);
  app.use('/upcoming', upcomingRouter);
  app.use('/uploads', uploadsRouter);
  // Public, tokenized ICS feed - no auth (the URL token is the credential).
  app.use('/calendar', calendarFeedRouter);

  // Dev/QA-only reminder triggers (TODO Stage 13). Never mounted in production.
  if (env.NODE_ENV !== 'production') {
    app.use('/dev', devRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
