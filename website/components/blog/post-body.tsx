import { linkifyKeywords } from "@/lib/blog/keyword-links";
import { normalizePostLinks } from "@/lib/blog/link-normalize";
import type { Keyword, LinkOccurrences } from "@/lib/blog/types";

/**
 * Renders a post's (already-sanitized) HTML with stale hrefs repaired and
 * keyword backlinks injected. Server component — both passes run on the server
 * so crawlers see the real anchors. Safe to dangerouslySetInnerHTML: the body
 * was sanitized at save time, the normalizer only ever shortens a URL, and
 * keyword URLs were validated to be http(s).
 *
 * Normalization runs first. The two passes are independent — the normalizer only
 * touches anchors that already exist, the injector only touches text outside
 * them — but going in this order means the normalizer sees exactly the markup
 * sanitize.ts wrote, rather than markup another pass just assembled, and the
 * anchors the injector adds are already normalized at their source (their URLs
 * go through the same rule inside linkifyKeywords).
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
  const html = linkifyKeywords(normalizePostLinks(body), keywords, linkOccurrences);
  return (
    <div
      className="prose-blog"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
