import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { loadEnv } from './lib/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth';
import { calendarFeedRouter, calendarRouter } from './routes/calendar';
import { configRouter } from './routes/config';
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
  app.use(helmet());

  // Allow the app + website origins; non-browser clients (mobile, REST tools)
  // have no Origin and are unaffected.
  app.use(cors({ origin: [env.APP_ORIGIN, env.WEBSITE_ORIGIN], credentials: true }));

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
  // Public, tokenized ICS feed — no auth (the URL token is the credential).
  app.use('/calendar', calendarFeedRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
