/**
 * Key/value config store for the analytics hub, backed by the shared Mongo
 * cluster (Vercel-serverless-safe via the cached connection in lib/blog/db.ts).
 * One collection `analyticshub_config` holds every setting — provider credentials
 * (encrypted before they get here), the project identity, the source-status
 * flags, OAuth state nonces, and the 6h data cache. A TTL index reaps anything
 * with an `expiresAt` in the past (cache entries + nonces); permanent config
 * leaves `expiresAt` null and is never reaped.
 */
import mongoose, { Schema, type Model } from "mongoose";

import { connectDb } from "@/lib/blog/db";

interface ConfigDoc {
  key: string;
  value: string;
  expiresAt?: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

const configSchema = new Schema<ConfigDoc>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "analyticshub_config" },
);
// Mongo deletes a doc shortly after `expiresAt`; docs with null never expire.
configSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AnalyticsHubConfig: Model<ConfigDoc> =
  (mongoose.models.AnalyticsHubConfig as Model<ConfigDoc>) ||
  mongoose.model<ConfigDoc>("AnalyticsHubConfig", configSchema);

type LeanRow = { key: string; value: string; expiresAt?: Date | null };

function isExpired(row: { expiresAt?: Date | null }): boolean {
  return Boolean(row.expiresAt && row.expiresAt.getTime() <= Date.now());
}

/** Read a single value, or null if missing/expired (guards against TTL lag). */
export async function getRaw(key: string): Promise<string | null> {
  await connectDb();
  const doc = await AnalyticsHubConfig.findOne({ key }).lean<LeanRow | null>();
  if (!doc || isExpired(doc)) return null;
  return doc.value ?? null;
}

/** Read many keys at once → Map of the present, unexpired ones. */
export async function getManyRaw(keys: string[]): Promise<Map<string, string>> {
  await connectDb();
  const docs = await AnalyticsHubConfig.find({ key: { $in: keys } }).lean<LeanRow[]>();
  const out = new Map<string, string>();
  for (const doc of docs) {
    if (!isExpired(doc)) out.set(doc.key, doc.value);
  }
  return out;
}

/** Upsert a value; `ttlSeconds` makes it self-expiring (cache / nonce). */
export async function setRaw(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  await connectDb();
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
  await AnalyticsHubConfig.updateOne(
    { key },
    { $set: { value, expiresAt } },
    { upsert: true },
  );
}

export async function del(key: string): Promise<void> {
  await connectDb();
  await AnalyticsHubConfig.deleteOne({ key });
}

/** Delete every key beginning with `prefix` (used to bust a source's cache). */
export async function delByPrefix(prefix: string): Promise<void> {
  await connectDb();
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await AnalyticsHubConfig.deleteMany({ key: { $regex: `^${escaped}` } });
}
