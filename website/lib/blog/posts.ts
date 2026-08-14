import { isValidObjectId } from "mongoose";

import { connectDb } from "./db";
import { Post, type PostDoc } from "./models";
import { rotateRelated } from "./seo-meta";
import { serializePost } from "./serialize";
import { slugify } from "./slug";
import type {
  Keyword,
  LinkOccurrences,
  Post as PostT,
  PostStatus,
  TemplateKey,
} from "./types";

export interface CreatePostInput {
  title: string;
  slug?: string;
  template: TemplateKey;
  body: string; // already sanitized by the caller
  excerpt: string;
  metaTitle: string;
  coverImage: string;
  coverImageAlt: string;
  keywords: Keyword[];
  linkOccurrences: LinkOccurrences;
  author: string;
  status: PostStatus;
  /**
   * ISO date. When publishing: a future value schedules the post (hidden until
   * then — see `publishedFilter`); a past value backdates it. `null` means
   * "publish/keep visible now". Ignored while a draft. Omit to keep as-is.
   */
  publishedAt?: string | null;
}

export type UpdatePostInput = Partial<CreatePostInput>;

/**
 * Match filter for posts that are publicly visible *right now*. A post is
 * "scheduled" when it is published with a future `publishedAt`; it stays hidden
 * on the public site until that moment, then appears automatically (the blog
 * routes are force-dynamic, so there's no cron and no ISR lag). The `$or` also
 * keeps legacy published posts that never got a `publishedAt` visible.
 *
 * Returns a fresh object each call so `new Date()` is evaluated at query time.
 */
export function publishedFilter() {
  return {
    status: "published" as const,
    $or: [
      { publishedAt: { $lte: new Date() } },
      { publishedAt: { $exists: false } },
      { publishedAt: null },
    ],
  };
}

export interface PaginatedPosts {
  posts: PostT[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** True for a Mongo duplicate-key (E11000) error — a slug collision lost a race. */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/** Find a slug not already taken (optionally ignoring the post being edited). */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 2;
  // Bounded loop — a handful of collisions at most in practice.
  for (let i = 0; i < 1000; i++) {
    const existing = await Post.findOne({ slug: candidate }).select("_id").lean();
    if (!existing || (excludeId && existing._id.toString() === excludeId)) {
      return candidate;
    }
    candidate = `${root}-${n++}`;
  }
  return `${root}-${Date.now()}`;
}

export async function getPublishedPosts(
  page = 1,
  pageSize = 9,
): Promise<PaginatedPosts> {
  await connectDb();
  const filter = publishedFilter();
  const total = await Post.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const docs = await Post.find(filter)
    .sort({ publishedAt: -1, createdAt: -1 })
    .skip((safePage - 1) * pageSize)
    .limit(pageSize)
    .lean();
  return {
    posts: (docs as unknown as PostDoc[]).map(serializePost),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * Lean, uncapped list of published posts for the sitemap (slug + updatedAt only),
 * so the sitemap never silently drops posts beyond a page size.
 */
export async function getPublishedSlugs(): Promise<
  { slug: string; updatedAt: string }[]
> {
  await connectDb();
  const docs = await Post.find(publishedFilter())
    .select("slug updatedAt")
    .sort({ publishedAt: -1 })
    .lean();
  return (docs as unknown as { slug: string; updatedAt: Date }[]).map((d) => ({
    slug: d.slug,
    updatedAt: new Date(d.updatedAt).toISOString(),
  }));
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<PostT | null> {
  await connectDb();
  const doc = await Post.findOne({
    slug: slug.toLowerCase(),
    ...publishedFilter(),
  }).lean();
  return doc ? serializePost(doc as unknown as PostDoc) : null;
}

/** The fields a related-post link needs. Deliberately no `body` — see below. */
export interface RelatedPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date to show under the link (`publishedAt`, falling back to creation). */
  date: string;
}

/**
 * The other posts to link to from the bottom of `/blog/<slug>`.
 *
 * Every post used to have exactly one incoming internal link — the blog index —
 * which also stranded anything on index page 2+ at crawl depth 3 or 4. Linking
 * each post to the N newest wouldn't fix that (the same N would collect every
 * link), so the ordering is a rotation: sort published posts newest-first and
 * take the N that follow this one, wrapping at the end. That hands every post the
 * same number of incoming links and no post is more than a couple of hops in.
 *
 * The projection drops `body`, which is the whole weight of a post, so pulling
 * the full list to find our position stays a cheap read.
 */
export async function getRelatedPosts(
  slug: string,
  limit = 3,
): Promise<RelatedPost[]> {
  await connectDb();
  const docs = (await Post.find(publishedFilter())
    .select("slug title excerpt publishedAt createdAt")
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean()) as unknown as {
    slug: string;
    title: string;
    excerpt?: string;
    publishedAt?: Date | null;
    createdAt?: Date;
  }[];

  const rows: RelatedPost[] = docs.map((d) => ({
    slug: d.slug,
    title: d.title,
    excerpt: d.excerpt ?? "",
    date: new Date(d.publishedAt ?? d.createdAt ?? 0).toISOString(),
  }));

  const current = rows.findIndex((r) => r.slug === slug.toLowerCase());
  // Unknown slug (a preview, say) — the newest posts are the sensible default.
  if (current < 0) return rows.slice(0, limit);
  return rotateRelated(rows, current, limit);
}

export async function getAllPosts(): Promise<PostT[]> {
  await connectDb();
  const docs = await Post.find({}).sort({ updatedAt: -1 }).lean();
  return (docs as unknown as PostDoc[]).map(serializePost);
}

export async function getPostById(id: string): Promise<PostT | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await Post.findById(id).lean();
  return doc ? serializePost(doc as unknown as PostDoc) : null;
}

export async function createPost(input: CreatePostInput): Promise<PostT> {
  await connectDb();
  // metaTitle is stored as-entered (possibly empty); the public pages fall back
  // to the title at render time, so it stays in sync if the title is renamed.
  const base = {
    title: input.title.trim(),
    template: input.template,
    body: input.body,
    excerpt: input.excerpt,
    metaTitle: input.metaTitle.trim(),
    coverImage: input.coverImage,
    coverImageAlt: input.coverImageAlt,
    keywords: input.keywords,
    linkOccurrences: input.linkOccurrences,
    author: input.author,
    status: input.status,
    // Honor an explicit date (so a post can be created already-scheduled), else
    // stamp now when publishing, else null while a draft.
    publishedAt: input.publishedAt
      ? new Date(input.publishedAt)
      : input.status === "published"
        ? new Date()
        : null,
  };

  // The slug check (read) and insert (write) aren't atomic, so two posts with the
  // same title racing can both pick the same slug; the unique index then rejects
  // the loser with E11000. Retry with a freshly de-duped slug instead of 500ing.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await uniqueSlug(input.slug?.trim() || input.title);
    try {
      const doc = await Post.create({ ...base, slug });
      return serializePost(doc.toObject() as unknown as PostDoc);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("Could not generate a unique slug.");
}

export async function updatePost(
  id: string,
  input: UpdatePostInput,
): Promise<PostT | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await Post.findById(id);
  if (!doc) return null;

  if (input.title !== undefined) doc.title = input.title.trim();
  // Recompute the slug only when explicitly provided (lets the team rename it).
  if (input.slug !== undefined) {
    doc.slug = await uniqueSlug(input.slug.trim() || doc.title, id);
  }
  if (input.template !== undefined) doc.template = input.template;
  if (input.body !== undefined) doc.body = input.body;
  if (input.excerpt !== undefined) doc.excerpt = input.excerpt;
  if (input.metaTitle !== undefined) {
    // Stored as-entered (may be empty) so it keeps falling back to the live title.
    doc.metaTitle = input.metaTitle.trim();
  }
  if (input.coverImage !== undefined) doc.coverImage = input.coverImage;
  if (input.coverImageAlt !== undefined) doc.coverImageAlt = input.coverImageAlt;
  if (input.keywords !== undefined) doc.keywords = input.keywords;
  if (input.linkOccurrences !== undefined) {
    doc.linkOccurrences = input.linkOccurrences;
  }
  if (input.author !== undefined) doc.author = input.author;

  // Resolve publishedAt against the *resulting* status. Splitting the date logic
  // from the status assignment is what fixes the scheduled→visible bug: when the
  // team flips a scheduled post to Visible (status:"published", publishedAt:null),
  // a still-future stored date is not <= now, so it collapses to now and the post
  // goes live immediately instead of staying hidden behind its old future date.
  const now = new Date();
  const nextStatus = input.status ?? doc.status;
  if (nextStatus === "published") {
    if (input.publishedAt != null) {
      // Explicit date → schedule (future) or backdate (past).
      doc.publishedAt = new Date(input.publishedAt);
    } else if (input.status === "published" || input.publishedAt === null) {
      // "Make/keep visible now": keep an existing PAST date (preserves the
      // canonical publish time on plain edits), else stamp now.
      doc.publishedAt =
        doc.publishedAt && doc.publishedAt <= now ? doc.publishedAt : now;
    }
    // else: already published, nothing about the date sent → leave it as-is.
  }
  // nextStatus === "draft": leave publishedAt untouched (keep the original date).
  if (input.status !== undefined) doc.status = input.status;

  // Retry on a slug-collision race (see createPost) by re-deriving a free slug.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await doc.save();
      return serializePost(doc.toObject() as unknown as PostDoc);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      lastErr = err;
      doc.slug = await uniqueSlug(doc.slug, id);
    }
  }
  throw lastErr ?? new Error("Could not generate a unique slug.");
}

export async function deletePost(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectDb();
  const res = await Post.findByIdAndDelete(id);
  return Boolean(res);
}

/**
 * Best-effort view counter; never throws into the render path.
 *
 * `timestamps: false` is load-bearing, not tidiness. The schema sets
 * `timestamps: true`, which Mongoose also applies to `updateOne` — so without
 * this, every single page view moved `updatedAt`. That field is the post's
 * `dateModified` in its structured data *and* its `lastModified` in the sitemap,
 * so a counter meant to be invisible was telling Google that every post on the
 * site had been rewritten today, every day.
 */
export async function incrementViews(slug: string): Promise<void> {
  try {
    await connectDb();
    await Post.updateOne(
      { slug: slug.toLowerCase(), ...publishedFilter() },
      { $inc: { views: 1 } },
      { timestamps: false },
    );
  } catch {
    // monitoring metric only — ignore failures
  }
}
