import { PreferredSourceCallout } from "@/components/preferred-source/preferred-source-callout";
import { linkifyKeywords } from "@/lib/blog/keyword-links";
import { normalizePostLinks } from "@/lib/blog/link-normalize";
import type { Keyword, LinkOccurrences } from "@/lib/blog/types";
import { splitOnPreferredSource } from "@/lib/preferred-source";

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
 *
 * A `[preferred-source]` line in the body becomes the preferred-source card at
 * that spot. The HTML is split there and the card sits *between* prose blocks,
 * not inside one, so `.prose-blog a` styles never reach its button.
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
  const segments = splitOnPreferredSource(html);

  if (segments.length === 1) {
    return <div className="prose-blog" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <>
      {segments.map((segment, index) => (
        <div key={index}>
          {index > 0 && <PreferredSourceCallout className="my-8" />}
          {segment.trim() && (
            <div className="prose-blog" dangerouslySetInnerHTML={{ __html: segment }} />
          )}
        </div>
      ))}
    </>
  );
}
