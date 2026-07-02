import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the backend test suite (TODO Stage 13). Unit tests cover the
 * pure logic libs (dates, scheduling, fair-use, access, retry, copy, ICS, CSV);
 * integration tests drive the real Express app over supertest against an
 * ephemeral in-memory MongoDB (the same `mongodb-memory-server` the smoke
 * scripts use). The hand-rolled `npm run smoke:*` scripts stay as a second,
 * coarser end-to-end net; these add fast, isolated, framework-reported coverage.
 *
 * Files run sequentially (`fileParallelism: false`) so at most one in-memory
 * mongod is alive at a time - cheaper and more deterministic on CI runners than
 * spawning one per worker. Required JWT/CORS env is injected here so `loadEnv()`
 * validates in every test; each DB-backed file sets its own `MONGODB_URI`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      // A placeholder so the schema's `MONGODB_URI` min(1) passes at import time;
      // DB-backed tests override `process.env.MONGODB_URI` before connecting.
      MONGODB_URI: 'mongodb://127.0.0.1:27017/placeholder',
      JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0123',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-0123',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '30d',
      SMS_WHATSAPP_MONTHLY_CAP: '20',
      // A valid 32-byte (base64) key so token-crypto tests can encrypt/decrypt.
      GMAIL_TOKEN_ENC_KEY: '23vgi3FIiuDf5va/WTJSv9SKKe/4ffa7T1X2aXDmF5U=',
      // Twilio auto-send SMS config so twilio-send unit tests see it "configured"
      // (a Messaging Service sender; no From number, exercising that branch).
      TWILIO_ACCOUNT_SID: 'ACtest0000000000000000000000000000',
      TWILIO_AUTH_TOKEN: 'test-auth-token',
      TWILIO_MESSAGING_SERVICE_SID: 'MGtest0000000000000000000000000000',
      // Pin the in-memory MongoDB binary so every run reuses one cached download.
      MONGOMS_VERSION: '7.0.24',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/types/**', 'src/**/*.d.ts'],
    },
  },
});
