import mongoose from 'mongoose';

import { logger } from './logger';

/**
 * MongoDB connection (TODO Stage 1). Fails fast: if the initial connection
 * can't be established the caller (server bootstrap) exits.
 */
export async function connectDb(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    logger.info(`MongoDB connected (${conn.connection.host}/${conn.connection.name})`);
    return conn;
  } catch (err) {
    logger.error('MongoDB connection failed:', err instanceof Error ? err.message : err);
    throw err;
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
