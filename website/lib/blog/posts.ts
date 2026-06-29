import { isValidObjectId } from "mongoose";

import { connectDb } from "./db";
import { Post, type PostDoc } from "./models";
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
}

export type UpdatePostInput = Partial<CreatePostInput>;

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
  const filter = { status: "published" as const };
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
  const docs = await Post.find({ status: "published" })
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
  const doc = await Post.findOne({ slug: slug.toLowerCase(), status: "published" }).lean();
  return doc ? serializePost(doc as unknown as PostDoc) : null;
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
    publishedAt: input.status === "published" ? new Date() : null,
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
  if (input.status !== undefined) {
    // Stamp publishedAt the first time a post goes live; keep it on unpublish.
    if (input.status === "published" && !doc.publishedAt) {
      doc.publishedAt = new Date();
    }
    doc.status = input.status;
  }

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

/** Best-effort view counter; never throws into the render path. */
export async function incrementViews(slug: string): Promise<void> {
  try {
    await connectDb();
    await Post.updateOne(
      { slug: slug.toLowerCase(), status: "published" },
      { $inc: { views: 1 } },
    );
  } catch {
    // monitoring metric only — ignore failures
  }
}
