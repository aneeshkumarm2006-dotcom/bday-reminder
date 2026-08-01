import Link from "next/link";

import { formatDate } from "@/lib/blog/format";
import type { RelatedPost } from "@/lib/blog/posts";

/**
 * Post-to-post links at the foot of an article. Without these a post's only
 * incoming link is the blog index, which left every post one link deep and the
 * older ones three or four clicks from the homepage.
 *
 * Kept out of `<PostArticle>` on purpose: that component is also rendered by
 * `/seoteam/preview/[id]`, and a draft preview shouldn't pay for a second DB read
 * to show links the author isn't reviewing.
 *
 * Anchor text is the post title, never "read more" — the link has to say where it
 * goes on its own.
 */
export function RelatedPosts({ posts }: { posts: RelatedPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section
      aria-labelledby="keep-reading"
      className="mx-auto w-full max-w-3xl px-5 pb-16"
    >
      <div className="border-t border-border-subtle pt-8">
        <h2
          id="keep-reading"
          className="font-display text-xl font-semibold text-ink"
        >
          Keep reading
        </h2>

        <ul className="mt-5 space-y-5">
          {posts.map((post) => (
            <li key={post.slug}>
              <h3 className="font-medium leading-snug text-ink">
                <Link
                  href={`/blog/${post.slug}`}
                  className="transition-colors hover:text-biro"
                >
                  {post.title}
                </Link>
              </h3>
              {post.excerpt && (
                <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                  {post.excerpt}
                </p>
              )}
              <time
                dateTime={post.date}
                className="mt-1 block text-xs text-ink-muted"
              >
                {formatDate(post.date)}
              </time>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-ink-muted">
          <Link href="/blog" className="text-ink underline hover:text-biro">
            Every post on the Birthday Reminders blog
          </Link>
        </p>
      </div>
    </section>
  );
}
