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
