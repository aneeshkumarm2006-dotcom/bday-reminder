import type { Keyword, KeywordRel, LinkOccurrences } from "./types";

/**
 * Turns occurrences of each keyword in a post's body into a backlink to its URL.
 *
 * Design notes:
 * - Operates on already-sanitized, well-formed HTML (see sanitize.ts), so a tag
 *   tokenizer is reliable here and lets us skip text inside anchors, headings,
 *   and code without a heavyweight DOM.
 * - Matching is case-insensitive and word-boundary aware; the original casing of
 *   the matched text is preserved in the link.
 * - "first" mode links only the first occurrence of each keyword across the whole
 *   document (avoids over-optimization); "all" links every occurrence.
 * - External links open in a new tab with rel="noopener" plus nofollow/sponsored
 *   when requested (dofollow adds nothing extra).
 */

const SKIP_TAGS = new Set([
  "A", "H1", "H2", "H3", "H4", "H5", "H6",
  "CODE", "PRE", "SCRIPT", "STYLE", "FIGCAPTION",
]);

// Elements that never have a closing tag, so they must not push onto the stack.
const VOID_TAGS = new Set([
  "AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT",
  "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function relFor(rel: KeywordRel): string {
  const parts = ["noopener"];
  if (rel === "nofollow") parts.push("nofollow");
  else if (rel === "sponsored") parts.push("sponsored");
  return parts.join(" ");
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function replaceInTextSegment(
  text: string,
  regex: RegExp,
  byText: Map<string, Keyword>,
  mode: LinkOccurrences,
  used: Set<string>,
): string {
  regex.lastIndex = 0;
  let out = "";
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const matched = match[0];
    const key = matched.toLowerCase();
    const cfg = byText.get(key);
    if (!cfg) continue;
    if (mode === "first" && used.has(key)) continue; // already linked once → leave as text
    out += text.slice(last, match.index);
    // `matched` is a slice of already-escaped HTML text, so emit it as-is.
    out += `<a href="${escapeAttr(cfg.url)}" target="_blank" rel="${relFor(
      cfg.rel,
    )}">${matched}</a>`;
    last = match.index + matched.length;
    if (mode === "first") used.add(key);
    // Guard against a zero-length match (shouldn't happen with real keywords).
    if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  out += text.slice(last);
  return out;
}

export function linkifyKeywords(
  html: string,
  keywords: Keyword[],
  mode: LinkOccurrences = "first",
): string {
  if (!html) return html;

  const valid = keywords.filter((k) => k.keyword.trim() && isHttpUrl(k.url));
  if (valid.length === 0) return html;

  // Lowercased keyword → config (first definition wins on duplicates).
  const byText = new Map<string, Keyword>();
  for (const k of valid) {
    const trimmed = k.keyword.trim();
    const key = trimmed.toLowerCase();
    if (!byText.has(key)) byText.set(key, { ...k, keyword: trimmed });
  }

  // Longest keyword first so a phrase wins over a word it contains.
  const ordered = [...byText.values()].sort(
    (a, b) => b.keyword.length - a.keyword.length,
  );
  const pattern = ordered.map((k) => escapeRegExp(k.keyword)).join("|");
  const regex = new RegExp(`\\b(?:${pattern})\\b`, "gi");

  const used = new Set<string>();
  const parts = html.split(/(<[^>]+>)/);
  const stack: string[] = [];
  let result = "";

  for (const part of parts) {
    if (!part) continue;
    if (part[0] === "<") {
      result += part;
      const tag = /^<\s*(\/?)\s*([a-zA-Z0-9]+)/.exec(part);
      if (tag) {
        const closing = tag[1] === "/";
        const name = tag[2].toUpperCase();
        const selfClosing = /\/\s*>$/.test(part) || VOID_TAGS.has(name);
        if (closing) {
          const idx = stack.lastIndexOf(name);
          if (idx !== -1) stack.length = idx; // pop back to the matching open tag
        } else if (!selfClosing) {
          stack.push(name);
        }
      }
      continue;
    }
    const inSkip = stack.some((t) => SKIP_TAGS.has(t));
    result += inSkip
      ? part
      : replaceInTextSegment(part, regex, byText, mode, used);
  }

  return result;
}
