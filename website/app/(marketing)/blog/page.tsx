import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { BlogPagination } from "@/components/blog/blog-pagination";
import { PostCard } from "@/components/blog/post-card";
import { CustomJsonLd } from "@/components/custom-json-ld";
import { isDbConfigured } from "@/lib/blog/db";
import { getPublishedPosts, type PaginatedPosts } from "@/lib/blog/posts";
import { getAllSeoPageContent, getPageMeta, getSiteSettings } from "@/lib/content/get";
import { buildPageMetadata, paginatedPageMeta } from "@/lib/content/metadata";

// Render on every request so newly published posts appear instantly (no redeploy).
export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

type BlogSearchParams = Promise<{ page?: string }>;

/** The page the visitor asked for, before the post count clamps it. */
function requestedPage(params: { page?: string }): number {
  return Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
}

/**
 * One post read shared by `generateMetadata` and the body. `getPublishedPosts`
 * isn't memoized and this route is force-dynamic, so without `cache()` every
 * request would run the same two queries twice. Null covers both "no database"
 * and "the read failed" — the page has a message for that, it doesn't throw.
 */
const loadPosts = cache(async (page: number): Promise<PaginatedPosts | null> => {
  if (!isDbConfigured()) return null;
  try {
    return await getPublishedPosts(page, PAGE_SIZE);
  } catch {
    return null;
  }
});

/**
 * Admin-managed (see /seoteam/meta), then re-pointed at the page being viewed.
 * The clamped `data.page` is what goes into the canonical, so `?page=99` on a
 * three-page blog canonicalises to the page it actually rendered instead of
 * minting a URL for a page that doesn't exist.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: BlogSearchParams;
}): Promise<Metadata> {
  const page = requestedPage(await searchParams);
  const [meta, settings, data] = await Promise.all([
    getPageMeta("/blog"),
    getSiteSettings(),
    loadPosts(page),
  ]);
  return buildPageMetadata(
    paginatedPageMeta(meta, data?.page ?? page, data?.totalPages),
    settings,
  );
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: BlogSearchParams;
}) {
  const page = requestedPage(await searchParams);
  // All three are memoized by React `cache()` — the same reads generateMetadata made.
  const [meta, data, guides] = await Promise.all([
    getPageMeta("/blog"),
    loadPosts(page),
    getAllSeoPageContent("published"),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <CustomJsonLd json={meta.customJsonLd} />
      <header className="mb-10">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Blog
        </h1>
        <p className="mt-2 text-ink-muted">{meta.description}</p>
        <p className="mt-4 max-w-2xl text-ink-muted">
          Party ideas, what to write in the card, which flowers mean what, and the odd
          printable. Some of it involves Birthday Reminders. Most of it doesn&rsquo;t.
        </p>
      </header>

      {!data || data.posts.length === 0 ? (
        <p className="text-ink-muted">
          {!data
            ? "The blog isn't available right now. Check back soon."
            : "No posts yet. Check back soon."}
        </p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          <BlogPagination page={data.page} totalPages={data.totalPages} />
        </>
      )}

      {/*
        Rendered on every page of the index, not just the first: it's what stops
        a deep pagination page from being a grid of posts and nothing else, and
        it's the only place the landing-page cluster is linked from the blog.
      */}
      {guides.length > 1 && (
        <section className="mt-16 border-t border-border-subtle pt-10">
          <h2 className="font-display text-xl font-semibold text-ink">
            If you came here looking for something specific
          </h2>
          <p className="mt-2 max-w-2xl text-ink-muted">
            {guides.length} guides, one topic each.
          </p>
          <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link href={`/${guide.slug}`} className="group block">
                  <span className="font-medium text-ink transition-colors group-hover:text-biro">
                    {guide.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-muted">{guide.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
