import { siteConfig } from "@/lib/site";

import type { Post } from "@/lib/blog/types";
import { isHttpUrl, jsonLdScript } from "@/lib/blog/url";

/**
 * Structured data for a blog post: BlogPosting + a Home → Blog → Post
 * BreadcrumbList. Emitted as <script type="application/ld+json">. The post
 * fields are HTML-escaped via jsonLdScript() so a "</script>" in the title or
 * excerpt can't break out of the tag.
 */
export function PostJsonLd({ post }: { post: Post }) {
  const url = `${siteConfig.url}/blog/${post.slug}`;
  // Google's Article guidelines treat `image` as required and can't fetch data:
  // URIs — always give it a crawlable http(s) image, falling back to the site OG.
  const image = isHttpUrl(post.coverImage)
    ? post.coverImage
    : `${siteConfig.url}/opengraph-image`;

  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.metaTitle || post.title,
    description: post.excerpt,
    image: [image],
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    author: { "@type": "Person", name: post.author || siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: `${siteConfig.url}/icon.svg` },
    },
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
