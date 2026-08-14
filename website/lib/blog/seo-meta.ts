import { parse } from "node-html-parser";

import { siteConfig } from "@/lib/site";

/**
 * Render-time repair of the two SEO defects the audit found on every
 * `/blog/<slug>` page: titles blown past 60 characters by the sitewide
 * `%s · Birthday Reminders` template, and posts published with an empty excerpt
 * (so no `<meta name="description">` at all). The fix has to live in code rather
 * than in the posts themselves — there are ~20 of them and the copy is owned by
 * whoever wrote it — so these helpers derive a good title and description from
 * what a post already has.
 *
 * Pure and isomorphic: no DB, no Next imports. The post page, the index card,
 * the BlogPosting JSON-LD and llms.txt all read the description from here, so
 * the `<title>`, the OG card and the structured data never disagree.
 */

/** Google truncates the SERP title around here; Semrush fails anything over. */
export const TITLE_BUDGET = 60;

/** Meta description target. Google shows ~155–160 characters on desktop. */
export const DESCRIPTION_BUDGET = 155;

/** Mirrors `DEFAULT_SETTINGS.seo.titleTemplate` without importing the whole content layer. */
export const DEFAULT_TITLE_TEMPLATE = `%s · ${siteConfig.name}`;

/**
 * A clause prefix shorter than this reads as a fragment, not a title ("5 Ideas",
 * "Part 2"), so we'd rather truncate the full title than cut there.
 */
const MIN_CLAUSE_LENGTH = 18;

/** Separators that end a self-contained opening clause in an English headline. */
const CLAUSE_SEPARATOR = String.raw`(?::|\s+[–—-]\s+|\s+\|\s+)`;

/** Trailing characters that would leave a shortened title dangling. */
const DANGLING = /[\s,;:.–—\-|/&]+$/;

/** The metadata `title` shape: a bare string lets Next append the sitewide template. */
export type MetadataTitle = string | { absolute: string };

export interface PostTitleSource {
  title: string;
  /** Author's manual override; wins over the post title when set. */
  metaTitle?: string;
}

export interface PostDescriptionSource {
  title?: string;
  excerpt?: string;
  /** Sanitized post HTML — the fallback source when there is no excerpt. */
  body?: string;
}

/** Squash entity-decoded whitespace (incl. the NBSP `&nbsp;` leaves behind). */
function collapse(text: string): string {
  return text.replace(/[\s\u00a0\u200b\ufeff]+/g, " ").trim();
}

/** Lowercased, punctuation-free form used only to compare a heading to a title. */
function normalizeForCompare(text: string): string {
  return collapse(text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " "));
}

/**
 * Block-level text of an HTML fragment, one entry per block, entities decoded.
 * `node-html-parser`'s `.structuredText` is what keeps "…do it.Next paragraph"
 * from happening while leaving inline `<strong>`/`<a>` runs glued to their words.
 */
function htmlToBlocks(html: string): string[] {
  const source = html || "";
  if (!source.trim()) return [];
  let raw: string;
  try {
    const root = parse(source);
    // Sanitized bodies shouldn't carry these, but a stray one would otherwise
    // land its source code in the meta description.
    for (const node of root.querySelectorAll("script,style,noscript")) {
      node.remove();
    }
    raw = root.structuredText;
  } catch {
    raw = source.replace(/<[^>]*>/g, " ");
  }
  return raw
    .split("\n")
    .map(collapse)
    .filter(Boolean);
}

/** Plain, whitespace-collapsed text of an HTML fragment. */
export function htmlToPlainText(html: string): string {
  return collapse(htmlToBlocks(html).join(" "));
}

/**
 * Words in an HTML fragment, for `BlogPosting.wordCount`.
 *
 * Deliberately built on `htmlToBlocks` rather than `readingTimeMinutes`, which
 * uses a looser parse: this one drops `script`/`style`/`noscript` first, so a
 * post carrying an embed doesn't have the embed's source counted as prose.
 */
export function wordCount(html: string): number {
  const text = htmlToPlainText(html ?? "");
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Every prefix of `title` that ends on a clause boundary, longest first — the
 * candidates for a shorter but still human headline. "50th Birthday Party Ideas:
 * Creative Ways to Celebrate a Milestone Birthday" yields "50th Birthday Party
 * Ideas".
 */
function clausePrefixes(title: string): string[] {
  const prefixes: string[] = [];
  const separator = new RegExp(CLAUSE_SEPARATOR, "g");
  let match: RegExpExecArray | null;
  while ((match = separator.exec(title)) !== null) {
    const prefix = title.slice(0, match.index).replace(DANGLING, "");
    if (prefix.length >= MIN_CLAUSE_LENGTH) prefixes.push(prefix);
  }
  return prefixes.reverse();
}

/** Hard cut at a word boundary, with an ellipsis, when nothing else fits. */
function truncateAtWord(text: string, budget: number): string {
  if (text.length <= budget) return text;
  // One character of the budget belongs to the ellipsis.
  const room = Math.max(1, budget - 1);
  const clipped = text.slice(0, room + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const head = lastSpace > 0 ? clipped.slice(0, lastSpace) : text.slice(0, room);
  return `${head.replace(DANGLING, "")}…`;
}

/**
 * The `<title>` for a post, kept inside `budget` characters *including* the
 * sitewide suffix. Candidates are tried longest-first — the full title, then each
 * clause prefix — and for each one we prefer the branded form (a bare string, so
 * the template appends) over the unbranded one (`{ absolute }`, which Next leaves
 * alone). Only when no candidate fits at all do we truncate mid-headline.
 *
 * `titleTemplate` comes from Site settings so an admin who changes the suffix
 * doesn't silently reintroduce over-long titles.
 */
export function buildPostTitle(
  post: PostTitleSource,
  options: { titleTemplate?: string; budget?: number } = {},
): MetadataTitle {
  const budget = options.budget ?? TITLE_BUDGET;
  const template = options.titleTemplate ?? DEFAULT_TITLE_TEMPLATE;
  const suffix = template.includes("%s") ? template.replace("%s", "") : null;
  const full = collapse(post.metaTitle || post.title || "");
  if (!full) return { absolute: siteConfig.name };

  for (const candidate of [full, ...clausePrefixes(full)]) {
    if (suffix !== null && candidate.length + suffix.length <= budget) {
      return candidate;
    }
    if (candidate.length <= budget) return { absolute: candidate };
  }
  return { absolute: truncateAtWord(full, budget) };
}

/** Split on sentence ends, leaving decimals and "e.g." style dots alone. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?][”"')\]]?)\s+(?=[“"'(\[]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The `<meta name="description">` for a post. The author's excerpt wins; when it
 * is empty — which is the case for about twenty published posts — we fall back to
 * the opening of the body, skipping a leading heading that just repeats the H1,
 * and stop on a sentence boundary so the snippet reads like a sentence rather
 * than a clipped one. Returns "" when there is nothing usable, so callers can
 * omit the tag instead of emitting an empty one.
 */
export function postDescription(
  post: PostDescriptionSource,
  options: { budget?: number } = {},
): string {
  const budget = options.budget ?? DESCRIPTION_BUDGET;
  const excerpt = collapse(post.excerpt ?? "");
  if (excerpt) return excerpt;

  const blocks = htmlToBlocks(post.body ?? "");
  const heading = normalizeForCompare(post.title ?? "");
  let start = 0;
  if (heading) {
    while (start < blocks.length && normalizeForCompare(blocks[start]) === heading) {
      start += 1;
    }
  }
  const text = collapse(blocks.slice(start).join(" "));
  if (!text) return "";
  if (text.length <= budget) return text;

  let out = "";
  for (const sentence of splitSentences(text)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > budget) break;
    out = next;
  }
  // No ellipsis here: we stopped on a full stop, so the snippet is complete.
  if (out) return out;
  return truncateAtWord(text, budget);
}

/** Same helper, under the name the blog index card and the post page import. */
export const buildPostDescription = postDescription;

/**
 * Deterministic "next N after me" window over a list, wrapping at the end.
 *
 * This is what makes related links actually fix the audit's "pages with only one
 * internal link". Linking every post to the N newest would pile all the equity on
 * the same N; rotating instead gives *every* post exactly N incoming links from
 * its neighbours, and shortens the crawl path to posts stranded on page 2 or 3 of
 * the index. Deterministic so two renders of the same page agree.
 */
export function rotateRelated<T>(items: T[], currentIndex: number, limit: number): T[] {
  if (limit <= 0 || items.length <= 1 || currentIndex < 0) return [];
  const take = Math.min(limit, items.length - 1);
  const out: T[] = [];
  for (let i = 1; i <= take; i++) {
    out.push(items[(currentIndex + i) % items.length]);
  }
  return out;
}
