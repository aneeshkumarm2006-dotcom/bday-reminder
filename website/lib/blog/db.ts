import mongoose from "mongoose";

/**
 * Serverless-safe Mongoose connection. Next.js route handlers / server
 * components can be invoked in many short-lived workers and the module graph is
 * re-imported on hot reload, so we cache the connection promise on globalThis
 * (the backend uses a plain fail-fast connect because it's one long-lived
 * process — see backend/src/lib/db.ts).
 */
const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _seoBlogMongoose: MongooseCache | undefined;
}

const cached: MongooseCache =
  global._seoBlogMongoose ?? (global._seoBlogMongoose = { conn: null, promise: null });

export async function connectDb(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to website/.env.local to enable the blog.",
    );
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    cached.promise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false,
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow a retry on the next request
    throw err;
  }
  return cached.conn;
}

/** True when a database URI is configured (used to render a helpful empty state). */
export function isDbConfigured(): boolean {
  return Boolean(MONGODB_URI);
}
