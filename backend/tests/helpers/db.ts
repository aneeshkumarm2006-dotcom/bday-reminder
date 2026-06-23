/**
 * Shared in-memory MongoDB harness for integration tests (TODO Stage 13).
 * Boots one ephemeral `mongodb-memory-server` per test file, connects Mongoose,
 * and clears every collection between tests so each `it` starts from a clean DB
 * — no Atlas required, mirroring the `scripts/smoke-*.ts` pattern.
 *
 * Usage:
 *   import { useTestDb } from './helpers/db';
 *   describe('…', () => { useTestDb(); it('…', async () => { … }); });
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';

let mongod: MongoMemoryServer | null = null;

/** Start the server + connect Mongoose (idempotent within a file). */
export async function startTestDb(): Promise<void> {
  if (mongod) return;
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  const { connectDb } = await import('../../src/lib/db');
  await connectDb(process.env.MONGODB_URI);
}

/** Drop all documents from every collection (between tests). */
export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** Disconnect Mongoose + stop the server. */
export async function stopTestDb(): Promise<void> {
  const { disconnectDb } = await import('../../src/lib/db');
  await disconnectDb();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

/** Register the standard beforeAll/afterEach/afterAll lifecycle for a suite. */
export function useTestDb(): void {
  beforeAll(startTestDb);
  afterEach(clearTestDb);
  afterAll(stopTestDb);
}
