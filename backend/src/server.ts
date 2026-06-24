import 'dotenv/config';

import dns from 'node:dns';

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

  // Work around Node/c-ares falling back to 127.0.0.1 for DNS on some Windows
  // setups, which breaks the SRV/TXT lookups behind `mongodb+srv://`. No-op
  // unless DNS_SERVERS is set (see .env / lib/env.ts).
  if (env.DNS_SERVERS) {
    const servers = env.DNS_SERVERS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (servers.length > 0) {
      dns.setServers(servers);
      logger.info(`DNS servers overridden: ${servers.join(', ')}`);
    }
  }

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
