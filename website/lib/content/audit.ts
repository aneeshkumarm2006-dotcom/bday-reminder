import { connectDb, isDbConfigured } from "@/lib/blog/db";

import { AuditLogModel, type AuditLogDoc } from "./models";
import type { AuditEntry } from "./types";

const MAX_ENTRIES = 2000;

function serialize(doc: AuditLogDoc): AuditEntry {
  return {
    id: doc._id.toString(),
    action: doc.action,
    entityType: doc.entityType as AuditEntry["entityType"],
    entityId: doc.entityId ?? "",
    summary: doc.summary ?? "",
    editor: doc.editor ?? "",
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/**
 * "Who changed what, when." The login is one shared password, so `editor` is
 * the self-declared display name from the (unsigned, non-auth) editor cookie —
 * attribution, never authorization. Best-effort: an audit write must never fail
 * a content save.
 */
export async function logAction(input: {
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  editor?: string;
}): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await connectDb();
    await AuditLogModel.create({
      action: input.action.slice(0, 80),
      entityType: input.entityType.slice(0, 40),
      entityId: (input.entityId ?? "").slice(0, 120),
      summary: (input.summary ?? "").slice(0, 300),
      editor: (input.editor ?? "").slice(0, 120),
    });

    // Cheap cap so the collection can't grow without bound; only runs when the
    // log is actually oversized.
    const total = await AuditLogModel.estimatedDocumentCount();
    if (total > MAX_ENTRIES * 1.25) {
      const stale = await AuditLogModel.find({})
        .sort({ createdAt: -1 })
        .skip(MAX_ENTRIES)
        .select("_id")
        .lean();
      if (stale.length > 0) {
        await AuditLogModel.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
      }
    }
  } catch (err) {
    console.error("logAction failed:", err);
  }
}

export async function listAudit(filter: {
  entityType?: string;
  editor?: string;
  since?: Date;
  limit?: number;
} = {}): Promise<AuditEntry[]> {
  if (!isDbConfigured()) return [];
  try {
    await connectDb();
    const query: Record<string, unknown> = {};
    if (filter.entityType) query.entityType = filter.entityType;
    if (filter.editor) query.editor = filter.editor;
    if (filter.since) query.createdAt = { $gte: filter.since };
    const docs = await AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(filter.limit ?? 100, 1), 500))
      .lean();
    return (docs as unknown as AuditLogDoc[]).map(serialize);
  } catch {
    return [];
  }
}

/** Distinct editor names seen in the log (for the activity filter dropdown). */
export async function listEditors(): Promise<string[]> {
  if (!isDbConfigured()) return [];
  try {
    await connectDb();
    const names = await AuditLogModel.distinct("editor");
    return (names as string[]).filter(Boolean).sort();
  } catch {
    return [];
  }
}
