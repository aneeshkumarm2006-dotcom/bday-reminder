import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Which page numbers to render, with `"gap"` where a run was skipped.
 *
 * Always includes the first and last page plus the current one's neighbours, so
 * the last page is one click from anywhere — prev/next alone put page 3 two hops
 * from `/blog`, which is how the posts that only live there ended up at crawl
 * depth 4 with a single link pointing at them.
 */
export function paginationPages(page: number, totalPages: number): (number | "gap")[] {
  const wanted = [1, page - 1, page, page + 1, totalPages]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const n of wanted) {
    if (n === previous) continue;
    if (previous && n - previous > 1) out.push("gap");
    out.push(n);
    previous = n;
  }
  return out;
}

/** Page 1 lives at the bare path — `?page=1` would be a second URL for it. */
function pageHref(page: number): string {
  return page <= 1 ? "/blog" : `/blog?page=${page}`;
}

/** Numbered pagination for the /blog index. Real links, so crawlers follow them. */
export function BlogPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-between"
      aria-label="Blog pagination"
    >
      {page > 1 ? (
        <Link
          href={pageHref(page - 1)}
          rel="prev"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          ← Newer posts
        </Link>
      ) : (
        <span className="hidden sm:block sm:w-32" />
      )}

      <ol className="flex items-center gap-1">
        {paginationPages(page, totalPages).map((item, i) =>
          item === "gap" ? (
            <li
              key={`gap-${i}`}
              className="px-1 text-sm text-ink-muted"
              aria-hidden="true"
            >
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span
                  aria-current="page"
                  className="flex h-9 min-w-9 items-center justify-center rounded-md border border-border-strong bg-surface-sunken px-2 text-sm font-medium text-ink"
                >
                  {item}
                </span>
              ) : (
                <Link
                  href={pageHref(item)}
                  aria-label={`Blog posts, page ${item} of ${totalPages}`}
                  className="flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  {item}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>

      {page < totalPages ? (
        <Link
          href={pageHref(page + 1)}
          rel="next"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          Older posts →
        </Link>
      ) : (
        <span className="hidden sm:block sm:w-32" />
      )}
    </nav>
  );
}
