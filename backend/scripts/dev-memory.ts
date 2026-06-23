/* eslint-disable no-console */
/**
 * Dev/QA only: run the real Express app against an ephemeral in-memory MongoDB
 * on :4040, so the web app can be exercised end-to-end without provisioning
 * Atlas. NOT for production. Stop with Ctrl-C.
 *
 * Run: npx tsx scripts/dev-memory.ts
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

// Pin the in-memory MongoDB version so every entry point (tests, smokes, this
// dev server, the E2E backend) reuses ONE cached binary instead of downloading
// a different default — keeps CI fast and offline-friendly. Must be set before
// MongoMemoryServer.create() reads it.
process.env.MONGOMS_VERSION ??= '7.0.24';

async function main(): Promise<void> {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'development';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET ??= 'dev-access-secret-dev-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'dev-refresh-secret-dev-refresh-secret';
  process.env.PORT ??= '4040';

  const { connectDb } = await import('../src/lib/db');
  const { createApp } = await import('../src/app');

  await connectDb(process.env.MONGODB_URI);
  const app = createApp();
  const port = Number(process.env.PORT);
  app.listen(port, () => {
    console.log(`READY in-memory backend on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
