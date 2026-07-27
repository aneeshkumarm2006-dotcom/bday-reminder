import { isValidObjectId } from "mongoose";

import { connectDb } from "@/lib/blog/db";
import { sanitizePostHtml } from "@/lib/blog/sanitize";
import { slugify } from "@/lib/blog/slug";

import { serializeSitePage } from "./get";
import { SitePageModel, type SitePageDoc } from "./models";
import { isReservedSlug } from "./reserved-slugs";
import type { PageBlock, PageStatus, SitePage } from "./types";

/**
 * CRUD for custom pages. Mirrors `lib/blog/posts.ts` (same slug-collision retry,
 * same publish/schedule date handling) so the two content types behave
 * identically where they overlap — a scheduled page and a scheduled post become
 * visible by exactly the same rule.
 */

export interface SitePageInput {
  title: string;
  slug?: string;
  status: PageStatus;
  publishedAt?: string | null;
  blocks: PageBlock[];
  showInSitemap: boolean;
  author: string;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && (err as { code?: number }).code === 11000
  );
}

/**
 * Rich-text blocks are the one place an editor supplies markup, so sanitize on
 * write with the blog's policy (no iframes, no scripts, no inline styles).
 * Doing it here rather than in the route means every path — create, update,
 * duplicate, import — is covered by construction.
 */
export function sanitizeBlocks(blocks: PageBlock[]): PageBlock[] {
  return blocks.map((block) =>
    block.type === "richText" ? { ...block, html: sanitizePostHtml(block.html) } : block,
  );
}

/** A free slug, honouring the reserved list and ignoring the page being edited. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = isReservedSlug(root) ? `${root}-page` : root;
  let n = 2;
  for (let i = 0; i < 1000; i++) {
    if (isReservedSlug(candidate)) {
      candidate = `${root}-${n++}`;
      continue;
    }
    const existing = await SitePageModel.findOne({ slug: candidate }).select("_id").lean();
    if (!existing || (excludeId && existing._id.toString() === excludeId)) return candidate;
    candidate = `${root}-${n++}`;
  }
  return `${root}-${Date.now()}`;
}

export async function createSitePage(input: SitePageInput): Promise<SitePage> {
  await connectDb();
  const base = {
    title: input.title.trim(),
    status: input.status,
    blocks: sanitizeBlocks(input.blocks),
    showInSitemap: input.showInSitemap,
    author: input.author,
    // Honour an explicit date (so a page can be created already scheduled),
    // else stamp now when publishing, else null while a draft.
    publishedAt: input.publishedAt
      ? new Date(input.publishedAt)
      : input.status === "published"
        ? new Date()
        : null,
  };

  // The slug check (read) and insert (write) aren't atomic, so two pages racing
  // can pick the same slug; the unique index rejects the loser with E11000.
  // Retry with a freshly de-duped slug instead of 500ing.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await uniqueSlug(input.slug?.trim() || input.title);
    try {
      const doc = await SitePageModel.create({ ...base, slug });
      return serializeSitePage(doc.toObject() as unknown as SitePageDoc);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("Could not generate a unique slug.");
}

export async function updateSitePage(
  id: string,
  input: Partial<SitePageInput>,
): Promise<SitePage | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await SitePageModel.findById(id);
  if (!doc) return null;

  if (input.title !== undefined) doc.title = input.title.trim();
  if (input.slug !== undefined) {
    doc.slug = await uniqueSlug(input.slug.trim() || doc.title, id);
  }
  if (input.blocks !== undefined) doc.blocks = sanitizeBlocks(input.blocks);
  if (input.showInSitemap !== undefined) doc.showInSitemap = input.showInSitemap;
  if (input.author !== undefined) doc.author = input.author;

  // Resolve publishedAt against the *resulting* status — the same fix the blog
  // needed: flipping a scheduled page to "publish now" must collapse a still
  // future date to now, or the read-gate keeps hiding it.
  const now = new Date();
  const nextStatus = input.status ?? doc.status;
  if (nextStatus === "published") {
    if (input.publishedAt != null) {
      doc.publishedAt = new Date(input.publishedAt);
    } else if (input.status === "published" || input.publishedAt === null) {
      doc.publishedAt = doc.publishedAt && doc.publishedAt <= now ? doc.publishedAt : now;
    }
  }
  if (input.status !== undefined) doc.status = input.status;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await doc.save();
      return serializeSitePage(doc.toObject() as unknown as SitePageDoc);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      lastErr = err;
      doc.slug = await uniqueSlug(doc.slug, id);
    }
  }
  throw lastErr ?? new Error("Could not generate a unique slug.");
}

export async function deleteSitePage(id: string): Promise<SitePage | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await SitePageModel.findByIdAndDelete(id);
  return doc ? serializeSitePage(doc.toObject() as unknown as SitePageDoc) : null;
}

/** Copy a page as a fresh draft (new slug, never inherits published state). */
export async function duplicateSitePage(id: string): Promise<SitePage | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await SitePageModel.findById(id).lean();
  if (!doc) return null;
  const source = doc as unknown as SitePageDoc;
  return createSitePage({
    title: `${source.title} (copy)`,
    slug: `${source.slug}-copy`,
    status: "draft",
    publishedAt: null,
    blocks: (source.blocks ?? []) as PageBlock[],
    showInSitemap: source.showInSitemap !== false,
    author: source.author ?? "",
  });
}

/** Admin read by id, regardless of publish state (for the editor and preview). */
export async function getSitePageById(id: string): Promise<SitePage | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await SitePageModel.findById(id).lean();
  return doc ? serializeSitePage(doc as unknown as SitePageDoc) : null;
}

/** True when the slug is free (and not reserved). Powers the availability check. */
export async function isSlugAvailable(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const normalized = slugify(slug);
  if (!normalized || isReservedSlug(normalized)) return false;
  await connectDb();
  const existing = await SitePageModel.findOne({ slug: normalized }).select("_id").lean();
  if (!existing) return true;
  return Boolean(excludeId && existing._id.toString() === excludeId);
}
