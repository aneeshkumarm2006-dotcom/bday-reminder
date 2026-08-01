import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/blog/format";
import { readingTimeMinutes } from "@/lib/blog/reading-time";
import { buildPostDescription } from "@/lib/blog/seo-meta";
import type { Post } from "@/lib/blog/types";

/**
 * A single post teaser on the /blog index.
 *
 * The teaser falls back to the opening of the body when a post was published
 * without an excerpt — plenty were — because otherwise the card is a headline
 * and a date, which reads as broken and leaves the index thin enough that the
 * audit flags it for word count and text-to-HTML ratio.
 *
 * The whole card is one link, so the anchor text starts with the post title.
 * It keeps the sitewide focus ring: suppressing it here left a keyboard user
 * with no indication of which card they were on.
 */
export function PostCard({ post }: { post: Post }) {
  const date = post.publishedAt ?? post.createdAt;
  const teaser = buildPostDescription(post);
  return (
    <Link href={`/blog/${post.slug}`} className="group block rounded-lg">
      <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-border-strong">
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/data URLs
          <img
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            className="aspect-[16/9] w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="aspect-[16/9] w-full bg-surface-sunken" aria-hidden="true" />
        )}
        <div className="flex flex-1 flex-col p-5">
          <h2 className="font-display text-lg font-semibold text-ink transition-colors group-hover:text-biro">
            {post.title}
          </h2>
          {teaser && (
            <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-ink-muted">{teaser}</p>
          )}
          <div className="mt-auto pt-4 flex items-center gap-2 text-xs text-ink-muted">
            <time dateTime={date}>{formatDate(date)}</time>
            <span aria-hidden="true">·</span>
            <span>{readingTimeMinutes(post.body)} min read</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
