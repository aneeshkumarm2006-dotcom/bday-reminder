import { linkifyKeywords } from "@/lib/blog/keyword-links";
import type { Keyword, LinkOccurrences } from "@/lib/blog/types";

/**
 * Renders a post's (already-sanitized) HTML with keyword backlinks injected.
 * Server component — the linkify runs on the server so crawlers see the real
 * anchors. Safe to dangerouslySetInnerHTML: the body was sanitized at save time
 * and keyword URLs were validated to be http(s).
 */
export function PostBody({
  body,
  keywords,
  linkOccurrences,
}: {
  body: string;
  keywords: Keyword[];
  linkOccurrences: LinkOccurrences;
}) {
  const html = linkifyKeywords(body, keywords, linkOccurrences);
  return (
    <div
      className="prose-blog"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
