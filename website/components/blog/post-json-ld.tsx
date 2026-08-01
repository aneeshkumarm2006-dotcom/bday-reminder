import { normalizeAuthorName } from "@/lib/content/site-json-ld";
import { siteConfig } from "@/lib/site";
import { organizationNode } from "@/lib/structured-data";

import { buildPostDescription } from "@/lib/blog/seo-meta";
import type { Post } from "@/lib/blog/types";
import { isHttpUrl, jsonLdScript } from "@/lib/blog/url";

/**
 * Structured data for a blog post: BlogPosting + a Home → Blog → Post
 * BreadcrumbList. Emitted as <script type="application/ld+json">. The post
 * fields are HTML-escaped via jsonLdScript() so a "</script>" in the title or
 * excerpt can't break out of the tag.
 */
export async function PostJsonLd({ post }: { post: Post }) {
  const url = `${siteConfig.url}/blog/${post.slug}`;
  // Admin-managed Organization (Site settings → Structured data), shared with
  // the homepage graph so both resolve to one entity.
  const publisher = await organizationNode();
  // Google's Article guidelines treat `image` as required and can't fetch data:
  // URIs — always give it a crawlable http(s) image, falling back to the site OG.
  const image = isHttpUrl(post.coverImage)
    ? post.coverImage
    : `${siteConfig.url}/opengraph-image`;

  // Roughly twenty posts were published with no excerpt, which left the
  // description empty here; the same helper that fills their meta description
  // fills it from the body. It can still come back empty for a body-less draft,
  // and an absent property beats an empty one.
  const description = buildPostDescription(post);

  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.metaTitle || post.title,
    ...(description ? { description } : {}),
    image: [image],
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    // Posts from before the rename are still signed by the retired brand.
    author: { "@type": "Person", name: normalizeAuthorName(post.author) },
    // Same Organization entity as the homepage (matched by @id), with a real
    // crawlable logo — the old `/icon.svg` no longer exists.
    publisher,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${siteConfig.url}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(blogPosting) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
      />
    </>
  );
}
