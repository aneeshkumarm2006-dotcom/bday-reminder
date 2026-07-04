import Link from "next/link";

import { PostBody } from "@/components/blog/post-body";
import { formatDate } from "@/lib/blog/format";
import { readingTimeMinutes } from "@/lib/blog/reading-time";
import type { Post } from "@/lib/blog/types";

/**
 * The public article body — breadcrumb, title, meta row, cover, and the post
 * HTML (with keyword backlinks injected server-side by <PostBody>). Extracted so
 * the public `/blog/[slug]` page and the `/seoteam/preview/[id]` page render the
 * exact same chrome. Server component. JSON-LD, metadata, and view-tracking stay
 * on the public page only.
 */
export function PostArticle({ post }: { post: Post }) {
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
    </article>
  );
}
