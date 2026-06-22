import 'dotenv/config';

import { createApp } from './app';
import { startReminderJobs } from './jobs';
import { connectDb } from './lib/db';
import { loadEnv } from './lib/env';
import { logger } from './lib/logger';

/**
 * Server bootstrap (TODO Stage 1). Validates env, connects to MongoDB (fail
 * fast), starts the reminder scheduler (Stage 4), then starts listening. Any
 * failure here exits the process with code 1.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  await connectDb(env.MONGODB_URI);

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // The node-cron reminder dispatcher runs in-process (FR-22/51-53).
  startReminderJobs();
}

main().catch((err) => {
  logger.error('Failed to start server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
