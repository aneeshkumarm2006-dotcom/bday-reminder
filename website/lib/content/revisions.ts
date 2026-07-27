import { isValidObjectId } from "mongoose";

import { connectDb, isDbConfigured } from "@/lib/blog/db";

import { ContentRevisionModel, type ContentRevisionDoc } from "./models";
import type { ContentRevision, EntityType } from "./types";

/** How many snapshots to keep per entity before the oldest are pruned. */
const KEEP_PER_ENTITY = 50;

function serialize(doc: ContentRevisionDoc): ContentRevision {
  return {
    id: doc._id.toString(),
    entityType: doc.entityType,
    entityId: doc.entityId,
    snapshot: doc.snapshot,
    savedBy: doc.savedBy ?? "",
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/**
 * Snapshot the *pre-save* state of an entity so any edit can be undone.
 *
 * Best-effort by design: a revision is a safety net, not the transaction — if
 * writing history fails, the content save must still go through, so this never
 * throws into a route handler.
 */
export async function saveRevision(
  entityType: EntityType,
  entityId: string,
  snapshot: unknown,
  savedBy: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await connectDb();
    await ContentRevisionModel.create({
      entityType,
      entityId: entityId || "singleton",
      snapshot,
      savedBy: savedBy.slice(0, 120),
    });

    // Count-prune (rather than a TTL) so a rarely-edited entity keeps its full
    // history while a busy one stays bounded.
    const stale = await ContentRevisionModel.find({ entityType, entityId })
      .sort({ createdAt: -1 })
      .skip(KEEP_PER_ENTITY)
      .select("_id")
      .lean();
    if (stale.length > 0) {
      await ContentRevisionModel.deleteMany({
        _id: { $in: stale.map((s) => s._id) },
      });
    }
  } catch (err) {
    console.error("saveRevision failed:", err);
  }
}

export async function listRevisions(filter: {
  entityType?: EntityType;
  entityId?: string;
  limit?: number;
}): Promise<ContentRevision[]> {
  if (!isDbConfigured()) return [];
  try {
    await connectDb();
    const query: Record<string, unknown> = {};
    if (filter.entityType) query.entityType = filter.entityType;
    if (filter.entityId) query.entityId = filter.entityId;
    const docs = await ContentRevisionModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(filter.limit ?? 50, 1), 200))
      .lean();
    return (docs as unknown as ContentRevisionDoc[]).map(serialize);
  } catch {
    return [];
  }
}

export async function getRevision(id: string): Promise<ContentRevision | null> {
  if (!isDbConfigured() || !isValidObjectId(id)) return null;
  try {
    await connectDb();
    const doc = await ContentRevisionModel.findById(id).lean();
    return doc ? serialize(doc as unknown as ContentRevisionDoc) : null;
  } catch {
    return null;
  }
}

/** Revision counts per entity, for the activity screen's sidebar. */
export async function revisionCounts(): Promise<Record<string, number>> {
  if (!isDbConfigured()) return {};
  try {
    await connectDb();
    const rows = await ContentRevisionModel.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$entityType", n: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  } catch {
    return {};
  }
}
