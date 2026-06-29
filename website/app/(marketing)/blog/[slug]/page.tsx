import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PostBody } from "@/components/blog/post-body";
import { PostJsonLd } from "@/components/blog/post-json-ld";
import { formatDate } from "@/lib/blog/format";
import { getPublishedPostBySlug, incrementViews } from "@/lib/blog/posts";
import { readingTimeMinutes } from "@/lib/blog/reading-time";
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

  const date = post.publishedAt ?? post.createdAt;

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
      <nav className="mb-6 text-sm text-ink-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span className="px-1.5" aria-hidden="true">
          /
        </span>
        <Link href="/blog" className="hover:text-ink">
          Blog
        </Link>
      </nav>

      <h1 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
        {post.title}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        {post.author && (
          <>
            <span>{post.author}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <time dateTime={date}>{formatDate(date)}</time>
        <span aria-hidden="true">·</span>
        <span>{readingTimeMinutes(post.body)} min read</span>
      </div>

      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/data URLs
        <img
          src={post.coverImage}
          alt={post.coverImageAlt || post.title}
          className="mt-6 w-full rounded-lg"
        />
      )}

      <div className="mt-8">
        <PostBody
          body={post.body}
          keywords={post.keywords}
          linkOccurrences={post.linkOccurrences}
        />
      </div>

      <PostJsonLd post={post} />
    </article>
  );
}
