/**
 * Shared blog/SEO types — pure, isomorphic (no DB or Node imports), so they can
 * be imported from both Server Components / route handlers and the client editor.
 */

export type KeywordRel = "dofollow" | "nofollow" | "sponsored";

/** A keyword backlink: occurrences of `keyword` in the body become a link to `url`. */
export interface Keyword {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

export type PostStatus = "draft" | "published";

/** Whether keyword backlinks hit only the first occurrence or every occurrence. */
export type LinkOccurrences = "first" | "all";

export type TemplateKey =
  | "how-to"
  | "listicle"
  | "comparison"
  | "review"
  | "news"
  | "generic";

/** The public, serialized shape of a post (plain JSON — safe to pass to client). */
export interface Post {
  id: string;
  title: string;
  slug: string;
  template: TemplateKey;
  /** Sanitized HTML (keyword backlinks are injected at render time, not stored). */
  body: string;
  excerpt: string;
  metaTitle: string;
  coverImage: string;
  coverImageAlt: string;
  keywords: Keyword[];
  linkOccurrences: LinkOccurrences;
  status: PostStatus;
  author: string;
  views: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  publishedAt: string | null; // ISO or null while a draft
}

/** A ready-made post template the SEO team picks from. Data-only (no React). */
export interface BlogTemplate {
  key: TemplateKey;
  name: string;
  description: string;
  /** Starter HTML pre-filling a sensible heading structure + guidance. */
  body: string;
  /** Placeholder guidance for the excerpt / meta description. */
  excerptHint: string;
}

export type SeoCheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id: string;
  label: string;
  status: SeoCheckStatus;
  detail: string;
}

export interface SeoAnalysis {
  checks: SeoCheck[];
  counts: { pass: number; warn: number; fail: number };
  /** True when nothing is failing — the post is "SEO-ready" to publish. */
  ready: boolean;
}

/**
 * A Cloudinary image asset tracked in the Media library (serialized JSON — safe
 * to pass to the client). Metadata mirrors the fields Cloudinary returns; alt
 * text is intentionally NOT stored here — it lives per-usage in the post HTML
 * (see `ImageUsage`), so editing it writes back into the posts.
 */
export interface BlogImage {
  id: string;
  /** Cloudinary public_id ("folder/name") — the stable identifier. */
  publicId: string;
  /** Delivery URL (Cloudinary secure_url). */
  secureUrl: string;
  /** File format: jpg | png | webp | … ("" if unknown). */
  format: string;
  width: number;
  height: number;
  bytes: number;
  tags: string[];
  /** Cloudinary upload time (ISO), or null if unknown. */
  cloudinaryCreatedAt: string | null;
  createdAt: string; // ISO — when the record was first tracked
  updatedAt: string; // ISO
}

/** One place an image is used: a post's cover, or an inline body `<img>`. */
export interface ImageUsage {
  postId: string;
  slug: string;
  title: string;
  field: "cover" | "body";
  /** The alt text at this usage, trimmed ("" when missing — the SEO gap). */
  alt: string;
}

/** A Media-library row: an image joined with its live usage across posts. */
export interface MediaRow {
  image: BlogImage;
  /** Every usage across all posts (may include multiple usages per post). */
  usedInPosts: ImageUsage[];
  /** True when the image is used somewhere with an empty alt (SEO gap). */
  missingAlt: boolean;
  /** True when no post references the image. */
  unused: boolean;
}

/** Summary returned by a media Sync run. */
export interface SyncSummary {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

/** Result of converting legacy JPG/PNG assets to WebP across the library. */
export interface WebpBackfillSummary {
  /** Assets that were re-encoded to WebP. */
  converted: number;
  /** Post URL references rewritten to the new WebP asset. */
  postsUpdated: number;
  /** Assets already WebP (or a format we don't convert, e.g. SVG/GIF). */
  skipped: number;
  /** Assets that errored during conversion (left untouched). */
  failed: number;
}
