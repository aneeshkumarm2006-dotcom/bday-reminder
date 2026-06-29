import type { Metadata } from "next";

import { BlogPagination } from "@/components/blog/blog-pagination";
import { PostCard } from "@/components/blog/post-card";
import { isDbConfigured } from "@/lib/blog/db";
import { getPublishedPosts, type PaginatedPosts } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/site";

// Render on every request so newly published posts appear instantly (no redeploy).
export const dynamic = "force-dynamic";

const DESCRIPTION = `Guides, tips, and product updates from ${siteConfig.name}.`;
const PAGE_SIZE = 9;

export const metadata: Metadata = {
  title: "Blog",
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: `Blog · ${siteConfig.name}`,
    description: DESCRIPTION,
    url: `${siteConfig.url}/blog`,
    type: "website",
  },
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  let data: PaginatedPosts | null = null;
  let failed = false;
  if (isDbConfigured()) {
    try {
      data = await getPublishedPosts(page, PAGE_SIZE);
    } catch {
      failed = true;
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Blog
        </h1>
        <p className="mt-2 text-ink-muted">{DESCRIPTION}</p>
      </header>

      {!data || data.posts.length === 0 ? (
        <p className="text-ink-muted">
          {failed || !isDbConfigured()
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
    </div>
  );
}
