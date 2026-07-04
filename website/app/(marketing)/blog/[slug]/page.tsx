import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PostArticle } from "@/components/blog/post-article";
import { PostJsonLd } from "@/components/blog/post-json-ld";
import { getPublishedPostBySlug, incrementViews } from "@/lib/blog/posts";
import type { Post } from "@/lib/blog/types";
import { isHttpUrl } from "@/lib/blog/url";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

// cache() dedupes the DB read across generateMetadata + the page render (Next
// only auto-dedupes fetch(), not arbitrary Mongoose calls) — one query/request.
const loadPost = cache(async (slug: string): Promise<Post | null> => {
  try {
    return await getPublishedPostBySlug(slug);
  } catch {
    return null;
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
  const title = post.metaTitle || post.title;
  // Social crawlers can't fetch data: URIs — use the cover only when it's a real
  // http(s) URL, else fall back to the site's OG image so cards still render.
  const images = [
    isHttpUrl(post.coverImage)
      ? post.coverImage
      : `${siteConfig.url}/opengraph-image`,
  ];

  return {
    title,
    description: post.excerpt,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description: post.excerpt,
      url: `${siteConfig.url}${canonical}`,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.author ? [post.author] : undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.excerpt,
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
  if (!post) notFound();

  // Monitoring metric — best-effort, never blocks/breaks the render.
  await incrementViews(post.slug);

  return (
    <>
      <PostArticle post={post} />
      <PostJsonLd post={post} />
    </>
  );
}
