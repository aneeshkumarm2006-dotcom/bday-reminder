import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cache } from "react";

import { PostArticle } from "@/components/blog/post-article";
import { PostJsonLd } from "@/components/blog/post-json-ld";
import { RelatedPosts } from "@/components/blog/related-posts";
import { recordNotFound, resolveRedirect } from "@/lib/content/redirects";
import {
  getPublishedPostBySlug,
  getRelatedPosts,
  incrementViews,
  type RelatedPost,
} from "@/lib/blog/posts";
import { buildPostTitle, postDescription } from "@/lib/blog/seo-meta";
import type { Post } from "@/lib/blog/types";
import { isHttpUrl } from "@/lib/blog/url";
import { getSiteSettings } from "@/lib/content/get";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

/** How many other posts each article links to. */
const RELATED_COUNT = 3;

// cache() dedupes the DB read across generateMetadata + the page render (Next
// only auto-dedupes fetch(), not arbitrary Mongoose calls) — one query/request.
const loadPost = cache(async (slug: string): Promise<Post | null> => {
  try {
    return await getPublishedPostBySlug(slug);
  } catch {
    return null;
  }
});

// A missing database costs us the related links, not the article.
const loadRelated = cache(async (slug: string): Promise<RelatedPost[]> => {
  try {
    return await getRelatedPosts(slug, RELATED_COUNT);
  } catch {
    return [];
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) {
    return { title: "Post not found", robots: { index: false, follow: false } };
  }

  const canonical = `/blog/${post.slug}`;
  // The sitewide suffix is admin-editable, so the length budget is measured
  // against the template that's actually live (cached read — the layout already
  // made it this request).
  const { seo } = await getSiteSettings();
  const title = buildPostTitle(post, { titleTemplate: seo.titleTemplate });
  // Posts published with an empty excerpt used to render no description at all;
  // this falls back to the body so every post has one.
  const description = postDescription(post);
  // Social crawlers can't fetch data: URIs — use the cover only when it's a real
  // http(s) URL, else fall back to the site's OG image so cards still render.
  const images = [
    isHttpUrl(post.coverImage)
      ? post.coverImage
      : `${siteConfig.url}/opengraph-image`,
  ];

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      ...(description ? { description } : {}),
      url: `${siteConfig.url}${canonical}`,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.author ? [post.author] : undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      ...(description ? { description } : {}),
      images,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) {
    // Same miss-path handling as the custom-page catch-all: a renamed post is
    // the other place old URLs go stale, so check the redirect table before 404.
    const rule = await resolveRedirect(`/blog/${slug}`);
    if (rule) {
      if (rule.type === 301) permanentRedirect(rule.to);
      redirect(rule.to);
    }
    await recordNotFound(`/blog/${slug}`);
    notFound();
  }

  // Monitoring metric — best-effort, never blocks/breaks the render.
  await incrementViews(post.slug);

  const related = await loadRelated(post.slug);

  return (
    <>
      <PostArticle post={post} />
      <RelatedPosts posts={related} />
      <PostJsonLd post={post} />
    </>
  );
}
