import { isValidObjectId } from "mongoose";

import { connectDb, isDbConfigured } from "@/lib/blog/db";

import {
  NotFoundHitModel,
  RedirectModel,
  type NotFoundHitDoc,
  type RedirectDoc,
} from "./models";
import type { NotFoundHit, Redirect } from "./types";
import { normalizePath } from "./validation";

/**
 * Redirects and 404 intelligence.
 *
 * Resolution deliberately happens on the *miss* path — the `[slug]` catch-all
 * and the marketing not-found — never in `proxy.ts`. Putting a Mongo lookup in
 * the proxy would tax every marketing request (and every static asset) to serve
 * the handful that 404; here the cost is paid only by requests that were going
 * to fail anyway. The proxy stays auth-only.
 */

function serializeRedirect(doc: RedirectDoc): Redirect {
  return {
    id: doc._id.toString(),
    from: doc.from,
    to: doc.to,
    type: doc.type,
    enabled: doc.enabled,
    note: doc.note ?? "",
    hits: doc.hits ?? 0,
    lastHitAt: doc.lastHitAt ? new Date(doc.lastHitAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function serializeHit(doc: NotFoundHitDoc): NotFoundHit {
  return {
    id: doc._id.toString(),
    path: doc.path,
    count: doc.count ?? 0,
    lastSeenAt: new Date(doc.lastSeenAt).toISOString(),
    referrer: doc.referrer ?? "",
  };
}

/**
 * The enabled redirect for a path, if any. Records the hit fire-and-forget:
 * analytics must never delay (or fail) the redirect itself.
 */
export async function resolveRedirect(
  path: string,
): Promise<{ to: string; type: 301 | 302 } | null> {
  if (!isDbConfigured()) return null;
  try {
    await connectDb();
    const from = normalizePath(path);
    const doc = await RedirectModel.findOne({ from, enabled: true }).lean();
    if (!doc) return null;

    void RedirectModel.updateOne(
      { _id: doc._id },
      { $inc: { hits: 1 }, $set: { lastHitAt: new Date() } },
    ).catch(() => undefined);

    return { to: doc.to, type: doc.type };
  } catch {
    return null;
  }
}

/**
 * Paths that are obvious scanner noise. Logging them would bury the real
 * broken links — a 404 log full of `/wp-login.php` tells you nothing.
 */
const BOT_NOISE =
  /(\.php$|\.asp[x]?$|\.env$|\.git|wp-|xmlrpc|phpmyadmin|\.well-known\/|admin\.php|\.sql$|\.bak$)/i;

export function isBotNoise(path: string): boolean {
  return BOT_NOISE.test(path);
}

/** Record a marketing 404. Best-effort: never throws into a render. */
export async function recordNotFound(path: string, referrer = ""): Promise<void> {
  if (!isDbConfigured()) return;
  const normalized = normalizePath(path);
  if (isBotNoise(normalized)) return;
  try {
    await connectDb();
    await NotFoundHitModel.updateOne(
      { path: normalized },
      {
        $inc: { count: 1 },
        $set: { lastSeenAt: new Date(), referrer: referrer.slice(0, 500) },
      },
      { upsert: true },
    );

    // Cap the collection so a scanner sweep can't grow it without bound.
    const total = await NotFoundHitModel.estimatedDocumentCount();
    if (total > 600) {
      const stale = await NotFoundHitModel.find({})
        .sort({ count: -1, lastSeenAt: -1 })
        .skip(500)
        .select("_id")
        .lean();
      if (stale.length > 0) {
        await NotFoundHitModel.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
      }
    }
  } catch {
    /* logging a 404 is never worth failing the 404 page over */
  }
}

export async function listRedirects(): Promise<Redirect[]> {
  if (!isDbConfigured()) return [];
  try {
    await connectDb();
    const docs = await RedirectModel.find({}).sort({ updatedAt: -1 }).lean();
    return (docs as unknown as RedirectDoc[]).map(serializeRedirect);
  } catch {
    return [];
  }
}

export async function listNotFoundHits(): Promise<NotFoundHit[]> {
  if (!isDbConfigured()) return [];
  try {
    await connectDb();
    const docs = await NotFoundHitModel.find({})
      .sort({ count: -1, lastSeenAt: -1 })
      .limit(200)
      .lean();
    return (docs as unknown as NotFoundHitDoc[]).map(serializeHit);
  } catch {
    return [];
  }
}

/**
 * Follow the redirect graph from `from` to detect a loop or an over-long chain.
 * Returns the offending path when the new rule would create one.
 */
export async function detectRedirectLoop(
  from: string,
  to: string,
  excludeId?: string,
): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const start = normalizePath(from);
  if (!to.startsWith("/")) return null; // external targets can't loop back here
  try {
    await connectDb();
    const seen = new Set<string>([start]);
    let current = normalizePath(to);
    for (let hop = 0; hop < 10; hop++) {
      if (seen.has(current)) return current;
      seen.add(current);
      const next = await RedirectModel.findOne({ from: current, enabled: true }).lean();
      if (!next) return null;
      if (excludeId && next._id.toString() === excludeId) return null;
      if (!next.to.startsWith("/")) return null;
      current = normalizePath(next.to);
    }
    return current; // 10 hops without terminating is a chain worth refusing
  } catch {
    return null;
  }
}

export async function createRedirectRule(input: {
  from: string;
  to: string;
  type: 301 | 302;
  enabled: boolean;
  note: string;
}): Promise<Redirect> {
  await connectDb();
  const doc = await RedirectModel.create({ ...input, from: normalizePath(input.from) });
  return serializeRedirect(doc.toObject() as unknown as RedirectDoc);
}

export async function updateRedirectRule(
  id: string,
  input: Partial<{ from: string; to: string; type: 301 | 302; enabled: boolean; note: string }>,
): Promise<Redirect | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const update = { ...input };
  if (update.from !== undefined) update.from = normalizePath(update.from);
  const doc = await RedirectModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  return doc ? serializeRedirect(doc as unknown as RedirectDoc) : null;
}

export async function deleteRedirectRule(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectDb();
  const doc = await RedirectModel.findByIdAndDelete(id);
  return Boolean(doc);
}

export async function dismissNotFound(path: string): Promise<void> {
  if (!isDbConfigured()) return;
  await connectDb();
  await NotFoundHitModel.deleteOne({ path: normalizePath(path) });
}
