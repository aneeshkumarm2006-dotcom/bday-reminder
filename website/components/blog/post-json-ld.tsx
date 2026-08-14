import { PageGraph } from "@/components/page-graph";
import { buildPostDescription } from "@/lib/blog/seo-meta";
import type { Post } from "@/lib/blog/types";
import { getPageMeta, getSiteSettings } from "@/lib/content/get";
import { articleId, blogPostingNodes, primaryImageId } from "@/lib/content/page-graph";

/**
 * Structured data for a blog post: one graph holding the page, the article, its
 * cover image, and a Home → Blog → Post breadcrumb, all cross-referenced by
 * `@id` and pointed at the same Organization the rest of the site uses.
 *
 * The author is the part worth knowing about. It used to be a `Person` named
 * from `normalizeAuthorName(post.author)`, which returns the *site name* when
 * nothing is stored — so every post with no byline claimed a human being called
 * "Birthday Reminders" had written it, while the page rendered no byline at all.
 * `authorNode` now returns a reference to the Organization in that case, and a
 * `Person` only for a name a person actually has.
 */
export async function PostJsonLd({ post }: { post: Post }) {
  const path = `/blog/${post.slug}`;
  // `PageMeta` is keyed by an arbitrary path, so a post can carry a per-page
  // JSON-LD override like every other route — this was the only public page
  // without that hook.
  const [settings, meta] = await Promise.all([getSiteSettings(), getPageMeta(path)]);
  const siteName = settings.structuredData.organization.name || settings.identity.name;
  const inLanguage = settings.structuredData.website.inLanguage || "en-US";

  return (
    <PageGraph
      path={path}
      name={post.metaTitle || post.title}
      description={buildPostDescription(post)}
      breadcrumb={[
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: post.title },
      ]}
      mainEntityId={articleId(post.slug)}
      primaryImageId={primaryImageId(path)}
      datePublished={post.publishedAt ?? post.createdAt}
      dateModified={post.updatedAt}
      nodes={blogPostingNodes({ post, path, siteName, inLanguage })}
      customJsonLd={meta.customJsonLd}
    />
  );
}
